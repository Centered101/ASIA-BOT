"use client";

import type { RefObject } from "react";

type ProfileImageCropModalProps = {
  title: string;
  subtitle: string;
  imageSrc: string;
  imageRef: RefObject<HTMLImageElement | null>;
  cropSize: number;
  panOffset: { x: number; y: number };
  imageNaturalSize: { w: number; h: number };
  cropScale: number;
  isDragging: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp: () => void;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: () => void;
  confirmLabel: React.ReactNode;
  confirmDisabled?: boolean;
  showZoom?: boolean;
  zoomValue?: number;
  onZoomChange?: (value: number) => void;
};

export default function ProfileImageCropModal({
  title,
  subtitle,
  imageSrc,
  imageRef,
  cropSize,
  panOffset,
  imageNaturalSize,
  cropScale,
  isDragging,
  onClose,
  onConfirm,
  onImageLoad,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  confirmLabel,
  confirmDisabled = false,
  showZoom = false,
  zoomValue = 1,
  onZoomChange,
}: ProfileImageCropModalProps) {
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/55 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-md max-h-[95dvh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-base">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="px-5 py-6 flex flex-col items-center gap-5">
          <div className="relative rounded-2xl overflow-hidden select-none bg-slate-950 shadow-inner border-2 border-slate-100"
            style={{
              width: cropSize,
              height: cropSize,
              cursor: isDragging ? "grabbing" : "grab",
              maxWidth: "min(280px, calc(100vw - 56px))",
              maxHeight: "min(280px, calc(100vw - 56px))",
              aspectRatio: "1 / 1",
              touchAction: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="crop"
              onLoad={onImageLoad}
              draggable={false}
              style={{
                position: "absolute",
                left: panOffset.x,
                top: panOffset.y,
                width: imageNaturalSize.w ? imageNaturalSize.w * cropScale : "auto",
                height: imageNaturalSize.h ? imageNaturalSize.h * cropScale : "auto",
                maxWidth: "none",
                maxHeight: "none",
                pointerEvents: "none",
                userSelect: "none",
                touchAction: "none",
              }}
            />
            <svg className="absolute inset-0 pointer-events-none" width={cropSize} height={cropSize} viewBox={`0 0 ${cropSize} ${cropSize}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
              <line x1={cropSize / 3} y1={0} x2={cropSize / 3} y2={cropSize} stroke="rgba(255,255,255,.32)" strokeWidth="1" />
              <line x1={cropSize * 2 / 3} y1={0} x2={cropSize * 2 / 3} y2={cropSize} stroke="rgba(255,255,255,.32)" strokeWidth="1" />
              <line x1={0} y1={cropSize / 3} x2={cropSize} y2={cropSize / 3} stroke="rgba(255,255,255,.32)" strokeWidth="1" />
              <line x1={0} y1={cropSize * 2 / 3} x2={cropSize} y2={cropSize * 2 / 3} stroke="rgba(255,255,255,.32)" strokeWidth="1" />
              <circle cx={cropSize / 2} cy={cropSize / 2} r={(cropSize / 2) - 2} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2" />
              <rect x={1} y={1} width={cropSize - 2} height={cropSize - 2} fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2" rx="16" />
            </svg>
            <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 0 999px rgba(15,23,42,.08)" }} />
          </div>

          {showZoom && onZoomChange && (
            <div className="w-full flex items-center gap-3 px-1">
              <i className="fa-solid fa-image text-slate-400 text-xs" />
              <input
                aria-label="ซูมรูป"
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoomValue}
                onChange={e => onZoomChange(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
              <i className="fa-solid fa-image text-slate-500 text-base" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-semibold text-sky-600 hover:bg-sky-50 transition">
            ยกเลิก
          </button>
          <button onClick={onConfirm} disabled={confirmDisabled}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-60 transition inline-flex items-center gap-2">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
