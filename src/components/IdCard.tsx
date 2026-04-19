import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { SCHOOL_INFO, type StudentData, formatDOB } from "@/lib/id-card-types";
import dpsLogo from "@/assets/dps_logo.png";

const CARD_W = 360;
const CARD_H = 560;

function SchoolHeader() {
  return (
    <div className="px-3 pt-3 pb-2 flex items-center gap-2">
      <img src={dpsLogo} alt="DPS Logo" className="h-10 w-10 shrink-0" />
      <div className="flex-1 leading-tight">
        <div className="text-brand-yellow font-extrabold text-[15px] tracking-tight">
          {SCHOOL_INFO.name}
        </div>
        <div className="text-white text-[9px] font-medium">{SCHOOL_INFO.tagline}</div>
      </div>
    </div>
  );
}

export function IdCardFront({ data, exportId }: { data: StudentData; exportId?: string }) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && data.barcodeValue) {
      try {
        JsBarcode(barcodeRef.current, data.barcodeValue, {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          height: 50,
          width: 2,
          background: "transparent",
        });
      } catch {
        /* noop */
      }
    }
  }, [data.barcodeValue]);

  return (
    <div
      id={exportId}
      className="id-card-shell shadow-xl"
      style={{ width: CARD_W, height: CARD_H, borderRadius: 18 }}
    >
      <SchoolHeader />

      <div className="id-inner mx-7 mt-1 p-3 flex flex-col items-center" style={{ height: 380 }}>
        <div
          className="border-[3px] border-brand-orange rounded-md overflow-hidden"
          style={{ width: 130, height: 130 }}
        >
          {data.photoDataUrl ? (
            <img src={data.photoDataUrl} alt="student" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted text-[10px] text-muted-foreground text-center px-1">
              Photo Required
            </div>
          )}
        </div>

        <div className="brand-orange-bg text-white font-extrabold text-[15px] px-4 py-1.5 rounded-md mt-3 text-center max-w-full truncate">
          {data.studentName || "STUDENT NAME"}
        </div>

        <div className="text-foreground font-extrabold text-[18px] mt-2">
          {data.className || "CLASS"}
        </div>

        <div className="brand-orange-bg text-white font-bold text-[12px] px-4 py-1 rounded-md mt-1">
          {data.transportType || "SCHOOL BUS"}
        </div>

        <div className="text-brand-orange font-extrabold text-[20px] mt-1">
          {data.busNumber || "B0"}
        </div>

        <div className="text-[10px] font-bold mt-1 text-center">
          BUS STOP : <span className="text-brand-red">{data.busStop || "—"}</span>
        </div>
        {data.busStopDetail && (
          <div className="text-[10px] font-bold text-brand-red text-center -mt-0.5">
            {data.busStopDetail}
          </div>
        )}
      </div>

      {/* House name vertical */}
      <div
        className="absolute text-white font-extrabold tracking-widest text-[13px]"
        style={{ left: 6, top: 230, writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {data.houseName || "HOUSE"}
      </div>

      <div className="absolute left-0 right-0 bottom-0 px-3 pb-2 text-center">
        <div className="text-white font-extrabold text-[16px]">
          ADMISSION No. {data.admissionNumber || "----"}
        </div>
        <div className="bg-white rounded-sm mt-1 px-2 py-1 flex items-center justify-center">
          <svg ref={barcodeRef} />
        </div>
        <div className="text-white text-[11px] font-semibold mt-0.5">
          {data.barcodeValue || "—"}
        </div>
      </div>
    </div>
  );
}

export function IdCardBack({ data, exportId }: { data: StudentData; exportId?: string }) {
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (qrRef.current && data.qrData) {
      QRCode.toCanvas(qrRef.current, data.qrData, { width: 110, margin: 1 }).catch(() => {});
    }
  }, [data.qrData]);

  return (
    <div
      id={exportId}
      className="id-card-shell shadow-xl"
      style={{ width: CARD_W, height: CARD_H, borderRadius: 18 }}
    >
      <div className="id-inner mx-3 mt-8 p-3" style={{ height: 420 }}>
        <div className="flex justify-center -mt-6 mb-2">
          <div className="brand-orange-bg text-white font-extrabold text-[15px] px-5 py-1.5 rounded-md shadow">
            Additional Information
          </div>
        </div>

        <div className="text-[12px] font-bold space-y-1.5 text-foreground">
          <Row label="F. NAME" value={data.fatherName} />
          <Row label="M. NAME" value={data.motherName} />
          <Row label="MOBILE NO" value={data.mobileNumber} />
          <Row label="D.O.B" value={formatDOB(data.dob)} />
          <Row label="B. GROUP" value={data.bloodGroup} />
          <Row label="ADDRESS" value={data.address} multiline />
        </div>

        <div className="flex justify-between items-end mt-3">
          <div className="text-center">
            {data.signatureDataUrl ? (
              <img src={data.signatureDataUrl} alt="sig" className="h-10 mx-auto object-contain" />
            ) : (
              <div className="h-10 w-20" />
            )}
            <div className="border-t border-foreground/40 pt-0.5 text-[10px] font-bold">
              Director/ Principal
            </div>
          </div>
          <div className="border-2 border-green-700 p-1 rounded">
            <canvas ref={qrRef} width={110} height={110} />
          </div>
        </div>
      </div>

      <div className="absolute left-0 right-0 bottom-0 px-3 pb-2 text-center">
        <div className="text-brand-yellow font-extrabold text-[16px] underline decoration-2 underline-offset-2">
          {SCHOOL_INFO.name.split(",")[0]}
        </div>
        <div className="text-white font-bold text-[10px] leading-tight">{SCHOOL_INFO.address}</div>
        <div className="text-white text-[9px] font-semibold">
          Mobile : {SCHOOL_INFO.mobile} {SCHOOL_INFO.website}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex gap-2">
      <div className="w-[78px] shrink-0">{label} :</div>
      <div
        className={`flex-1 font-semibold min-w-0 ${multiline ? "whitespace-pre-wrap break-words" : "truncate"}`}
      >
        {value || "—"}
      </div>
    </div>
  );
}
