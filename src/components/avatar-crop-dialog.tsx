"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Loader2Icon, ZoomInIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/i18n";
import { AVATAR_MAX_ZOOM, AVATAR_OUTPUT_SIZE } from "@/lib/avatar";

interface Offset {
  x: number;
  y: number;
}

/** Clamps an offset so the scaled image always fully covers the CROP_SIZE square — no empty edges. */
function clampOffset(offset: Offset, scale: number, bitmap: ImageBitmap): Offset {
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  const minX = Math.min(0, AVATAR_OUTPUT_SIZE - drawWidth);
  const minY = Math.min(0, AVATAR_OUTPUT_SIZE - drawHeight);
  return {
    x: Math.min(0, Math.max(minX, offset.x)),
    y: Math.min(0, Math.max(minY, offset.y)),
  };
}

/**
 * Lets the user pan and zoom the picked photo into a square before it's uploaded — a plain
 * center-crop (no user control) cut off faces/subjects unpredictably depending on the source
 * photo's framing. Renders to a circular preview (matching how the avatar displays everywhere
 * else) but exports a plain square JPEG; the circle is just a preview aid via CSS clipping.
 */
export function AvatarCropDialog({
  file,
  isSaving,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [coverScale, setCoverScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; offset: Offset } | null>(null);

  // Resets the decode state the instant the file identity changes (including to null, when the
  // dialog closes) — done during render rather than in the effect below so there's no stale
  // bitmap/error flash, and so the effect itself never calls setState synchronously.
  const [syncedFile, setSyncedFile] = useState<File | null>(null);
  if (file !== syncedFile) {
    setSyncedFile(file);
    setBitmap(null);
    setLoadError(false);
  }

  // Decode the picked file into a bitmap and set up the initial (centered, unzoomed) transform.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    createImageBitmap(file)
      .then((bmp) => {
        if (cancelled) {
          bmp.close();
          return;
        }
        const cover = Math.max(AVATAR_OUTPUT_SIZE / bmp.width, AVATAR_OUTPUT_SIZE / bmp.height);
        setBitmap(bmp);
        setCoverScale(cover);
        setZoom(1);
        setOffset({
          x: (AVATAR_OUTPUT_SIZE - bmp.width * cover) / 2,
          y: (AVATAR_OUTPUT_SIZE - bmp.height * cover) / 2,
        });
      })
      .catch(() => setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Releases the decoded bitmap when it's replaced or the dialog closes.
  useEffect(() => () => bitmap?.close(), [bitmap]);

  // Redraws the live preview whenever the transform changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !bitmap) return;
    const scale = coverScale * zoom;
    ctx.clearRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
    ctx.drawImage(bitmap, offset.x, offset.y, bitmap.width * scale, bitmap.height * scale);
  }, [bitmap, coverScale, zoom, offset]);

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!bitmap) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, offset };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || !bitmap) return;
    const next = { x: drag.offset.x + (event.clientX - drag.startX), y: drag.offset.y + (event.clientY - drag.startY) };
    setOffset(clampOffset(next, coverScale * zoom, bitmap));
  }

  function endDrag() {
    dragRef.current = null;
  }

  function handleZoomChange(nextZoom: number) {
    if (!bitmap) return;
    const oldScale = coverScale * zoom;
    const newScale = coverScale * nextZoom;
    // Keeps whatever image content is currently at the crop center anchored there while zooming,
    // instead of re-centering on the whole image (which would fight the user's existing pan).
    const centerImageX = (AVATAR_OUTPUT_SIZE / 2 - offset.x) / oldScale;
    const centerImageY = (AVATAR_OUTPUT_SIZE / 2 - offset.y) / oldScale;
    const next = {
      x: AVATAR_OUTPUT_SIZE / 2 - centerImageX * newScale,
      y: AVATAR_OUTPUT_SIZE / 2 - centerImageY * newScale,
    };
    setZoom(nextZoom);
    setOffset(clampOffset(next, newScale, bitmap));
  }

  function handleConfirm() {
    if (!bitmap) return;
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = coverScale * zoom;
    ctx.drawImage(bitmap, offset.x, offset.y, bitmap.width * scale, bitmap.height * scale);
    onConfirm(canvas.toDataURL("image/jpeg", 0.85));
  }

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("profile.cropTitle")}</DialogTitle>
          <DialogDescription>{t("profile.cropDescription")}</DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive">{t("profile.invalidImageFile")}</p>
        ) : (
          <div className="flex flex-col items-center gap-4 py-2">
            <div
              className="overflow-hidden rounded-full border bg-muted"
              style={{ width: AVATAR_OUTPUT_SIZE, height: AVATAR_OUTPUT_SIZE }}
            >
              <canvas
                ref={canvasRef}
                width={AVATAR_OUTPUT_SIZE}
                height={AVATAR_OUTPUT_SIZE}
                className="touch-none cursor-move"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerLeave={endDrag}
              />
            </div>
            <div className="flex w-full items-center gap-3 px-1">
              <ZoomInIcon className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="range"
                min={1}
                max={AVATAR_MAX_ZOOM}
                step={0.01}
                value={zoom}
                disabled={!bitmap}
                onChange={(event) => handleZoomChange(Number(event.target.value))}
                className="w-full accent-primary"
                aria-label={t("profile.zoomLabel")}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!bitmap || isSaving}>
            {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t("profile.saveCrop")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
