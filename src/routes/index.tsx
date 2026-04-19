import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { IdCardFront, IdCardBack } from "@/components/IdCard";
import {
  emptyStudent,
  formatPhone,
  type StudentData,
} from "@/lib/id-card-types";
import {
  downloadPdf,
  downloadPng,
  fileToDataUrl,
  zipCards,
} from "@/lib/id-card-export";
import {
  CsvColumnMapper,
  STUDENT_FIELDS,
  autoGuessMapping,
  type ColumnMapping,
} from "@/components/CsvColumnMapper";

const MAPPING_STORAGE_KEY = "id-card-csv-mapping-v1";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Student ID Card Generator — DPS Style" },
      { name: "description", content: "Generate professional student ID cards (front + back) individually or in bulk via CSV. Export PNG, PDF, ZIP." },
    ],
  }),
});

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

function Index() {
  const [data, setData] = useState<StudentData>(emptyStudent());
  const [bulk, setBulk] = useState<StudentData[]>([]);
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const [missingPhotos, setMissingPhotos] = useState<string[]>([]);
  const [photoStats, setPhotoStats] = useState<{ total: number; matched: number } | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const bulkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MAPPING_STORAGE_KEY);
      if (saved) setMapping(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  const update = <K extends keyof StudentData>(k: K, v: StudentData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const validate = (s: StudentData): string | null => {
    if (!s.studentName.trim()) return "Student name is required";
    if (!s.className.trim()) return "Class is required";
    if (!s.admissionNumber.trim()) return "Admission number is required";
    if (!s.photoDataUrl) return "Student photo is required";
    return null;
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>, key: "photoDataUrl" | "signatureDataUrl") => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = await fileToDataUrl(f);
    update(key, url);
  };

  const handleDownloadPng = async () => {
    const err = validate(data);
    if (err) return toast.error(err);
    if (frontRef.current) await downloadPng(frontRef.current, `${data.studentName}_front.png`);
    if (backRef.current) await downloadPng(backRef.current, `${data.studentName}_back.png`);
    toast.success("PNG downloaded");
  };

  const handleDownloadPdf = async () => {
    const err = validate(data);
    if (err) return toast.error(err);
    if (frontRef.current && backRef.current) {
      await downloadPdf(frontRef.current, backRef.current, `${data.studentName}_id.pdf`);
      toast.success("PDF downloaded");
    }
  };

  const applyPhotosToStudents = (students: StudentData[], map: Record<string, string>) => {
    const missing: string[] = [];
    let matched = 0;
    const withPhotos = students.map((s) => {
      const key = (s.admissionNumber || "").trim();
      const url = map[key];
      if (url) {
        matched++;
        return { ...s, photoDataUrl: url };
      }
      if (key) missing.push(key);
      return s;
    });
    setMissingPhotos(missing);
    if (Object.keys(map).length > 0) {
      setPhotoStats({ total: Object.keys(map).length, matched });
    }
    return withPhotos;
  };

  const handleCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data;
        const headers = res.meta.fields || (rows[0] ? Object.keys(rows[0]) : []);
        if (!headers.length) {
          toast.error("Could not detect CSV columns");
          return;
        }
        setCsvHeaders(headers);
        setCsvRows(rows);
        setBulk([]);
        // Pre-fill mapping: keep saved entries that still exist, then auto-guess the rest
        const guessed = autoGuessMapping(headers);
        const merged: ColumnMapping = { ...guessed };
        for (const [k, v] of Object.entries(mapping)) {
          if (headers.includes(v)) merged[k] = v;
        }
        setMapping(merged);
        toast.success(`Detected ${headers.length} columns, ${rows.length} rows`);
      },
      error: () => toast.error("Failed to parse CSV"),
    });
  };

  const transformRows = (
    rows: Record<string, string>[],
    map: ColumnMapping,
  ): StudentData[] => {
    const get = (r: Record<string, string>, key: string) => {
      const col = map[key];
      return col ? (r[col] ?? "").toString().trim() : "";
    };
    return rows.map((r) => {
      const admissionNumber = get(r, "admissionNumber");
      return {
        studentName: get(r, "studentName"),
        className: get(r, "className"),
        transportType: get(r, "transportType") || "SCHOOL BUS",
        busNumber: get(r, "busNumber"),
        busStop: get(r, "busStop"),
        busStopDetail: get(r, "busStopDetail"),
        houseName: get(r, "houseName"),
        admissionNumber,
        barcodeValue: get(r, "barcodeValue") || admissionNumber,
        fatherName: get(r, "fatherName"),
        motherName: get(r, "motherName"),
        mobileNumber: formatPhone(get(r, "mobileNumber")),
        dob: get(r, "dob"),
        bloodGroup: get(r, "bloodGroup"),
        address: get(r, "address"),
        qrData: get(r, "qrData") || admissionNumber,
      };
    });
  };

  const previewRows = useMemo(() => {
    if (!csvRows.length) return [] as StudentData[];
    return transformRows(csvRows.slice(0, 5), mapping);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvRows, mapping]);

  const applyMapping = () => {
    const missingRequired = STUDENT_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missingRequired.length) {
      toast.error(`Map required fields: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }
    const transformed = transformRows(csvRows, mapping);
    if (transformed.some((r) => !r.studentName || !r.admissionNumber)) {
      toast.error("Some rows are missing student name or admission number");
      return;
    }
    transformed.sort((a, b) => {
      const na = Number(a.admissionNumber);
      const nb = Number(b.admissionNumber);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.admissionNumber.localeCompare(b.admissionNumber);
    });
    const withPhotos = applyPhotosToStudents(transformed, photoMap);
    setBulk(withPhotos);
    try {
      localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(mapping));
    } catch {
      /* ignore */
    }
    toast.success(`Generated ${transformed.length} cards`);
  };

  const handlePhotoZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const zip = await JSZip.loadAsync(f);
      const map: Record<string, string> = {};
      const entries = Object.values(zip.files).filter(
        (zf) => !zf.dir && /\.(jpe?g|png)$/i.test(zf.name),
      );
      for (const zf of entries) {
        const base = zf.name.split("/").pop() || zf.name;
        const key = base.replace(/\.(jpe?g|png)$/i, "");
        const ext = base.split(".").pop()!.toLowerCase();
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        const blob = await zf.async("blob");
        const dataUrl: string = await new Promise((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(new Blob([blob], { type: mime }));
        });
        map[key.trim()] = dataUrl;
      }
      setPhotoMap(map);
      if (bulk.length > 0) {
        const updated = applyPhotosToStudents(bulk, map);
        setBulk(updated);
      } else {
        setPhotoStats({ total: Object.keys(map).length, matched: 0 });
      }
      toast.success(`Loaded ${Object.keys(map).length} photos from ZIP`);
    } catch {
      toast.error("Failed to read ZIP file");
    }
  };

  const downloadAllZip = async () => {
    if (!bulkRef.current) return;
    const cards: Array<{ name: string; front: HTMLElement; back: HTMLElement }> = [];
    bulk.forEach((s, i) => {
      const front = bulkRef.current!.querySelector<HTMLElement>(`#bulk-front-${i}`);
      const back = bulkRef.current!.querySelector<HTMLElement>(`#bulk-back-${i}`);
      if (front && back) cards.push({ name: s.studentName || `student_${i + 1}`, front, back });
    });
    if (!cards.length) return toast.error("No cards to export");
    toast.info("Generating ZIP, please wait...");
    await zipCards(cards, "id_cards.zip");
    toast.success("ZIP downloaded");
  };

  const sampleCsv = useMemo(
    () =>
      "studentName,className,transportType,busNumber,busStop,busStopDetail,houseName,admissionNumber,barcodeValue,fatherName,motherName,mobileNumber,dob,bloodGroup,address,qrData\nAchyutananda Gope,PREP-C,SCHOOL BUS,B7,MAMARKUDAR,NEAR TIYARA MORE,JAMUNA,1883,11883,Akhalesh Kumar Gope,Panchami Gope,7033247292,26/07/2020,O+,\"VILL-TIYARA, PO-DUDHIGAZAR, BOKARO\",1883",
    [],
  );

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="brand-blue-deep-bg text-white">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Student ID Card Generator</h1>
            <p className="text-sm opacity-80">Create DPS-style ID cards individually or in bulk</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="single">
          <TabsList>
            <TabsTrigger value="single">Single Entry</TabsTrigger>
            <TabsTrigger value="bulk">Bulk CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="mt-4">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-5 space-y-5">
                <section className="space-y-3">
                  <h2 className="text-sm font-bold uppercase text-brand-orange">Front Side</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Student Name" required>
                      <Input value={data.studentName} onChange={(e) => update("studentName", e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Class" required>
                      <Input value={data.className} onChange={(e) => update("className", e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Transport Type">
                      <Input value={data.transportType} onChange={(e) => update("transportType", e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Bus Number">
                      <Input value={data.busNumber} onChange={(e) => update("busNumber", e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Bus Stop">
                      <Input value={data.busStop} onChange={(e) => update("busStop", e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Bus Stop Detail">
                      <Input value={data.busStopDetail} onChange={(e) => update("busStopDetail", e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="House Name">
                      <Input value={data.houseName} onChange={(e) => update("houseName", e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Admission No." required>
                      <Input value={data.admissionNumber} onChange={(e) => {
                        update("admissionNumber", e.target.value);
                        if (!data.barcodeValue) update("barcodeValue", e.target.value);
                        if (!data.qrData) update("qrData", e.target.value);
                      }} />
                    </Field>
                    <Field label="Barcode Value">
                      <Input value={data.barcodeValue} onChange={(e) => update("barcodeValue", e.target.value)} />
                    </Field>
                    <Field label="Student Photo" required>
                      <Input type="file" accept="image/*" onChange={(e) => handlePhoto(e, "photoDataUrl")} />
                    </Field>
                  </div>
                </section>

                <section className="space-y-3 border-t pt-4">
                  <h2 className="text-sm font-bold uppercase text-brand-orange">Back Side</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Father Name">
                      <Input value={data.fatherName} onChange={(e) => update("fatherName", e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Mother Name">
                      <Input value={data.motherName} onChange={(e) => update("motherName", e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="Mobile Number">
                      <Input value={data.mobileNumber} onChange={(e) => update("mobileNumber", formatPhone(e.target.value))} />
                    </Field>
                    <Field label="Date of Birth">
                      <Input type="date" value={data.dob} onChange={(e) => update("dob", e.target.value)} />
                    </Field>
                    <Field label="Blood Group">
                      <Input value={data.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value.toUpperCase())} />
                    </Field>
                    <Field label="QR Code Data">
                      <Input value={data.qrData} onChange={(e) => update("qrData", e.target.value)} />
                    </Field>
                    <div className="col-span-2">
                      <Field label="Address">
                        <Textarea rows={2} value={data.address} onChange={(e) => update("address", e.target.value.toUpperCase())} />
                      </Field>
                    </div>
                    <Field label="Signature (optional)">
                      <Input type="file" accept="image/*" onChange={(e) => handlePhoto(e, "signatureDataUrl")} />
                    </Field>
                  </div>
                </section>

                <div className="flex gap-3 flex-wrap pt-2">
                  <Button onClick={handleDownloadPng}>Download PNG</Button>
                  <Button onClick={handleDownloadPdf} variant="secondary">Download PDF</Button>
                  <Button variant="outline" onClick={() => setData(emptyStudent())}>Reset</Button>
                </div>
              </Card>

              <div className="space-y-6">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Front</span>
                  <div ref={frontRef}>
                    <IdCardFront data={data} />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold uppercase text-muted-foreground">Back</span>
                  <div ref={backRef}>
                    <IdCardBack data={data} />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="mt-4 space-y-4">
            <Card className="p-5 space-y-3">
              <h2 className="font-bold">Bulk Upload</h2>
              <p className="text-sm text-muted-foreground">
                Upload any CSV — you'll map your columns to ID card fields in the next step.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <Input type="file" accept=".csv" onChange={handleCsv} className="max-w-sm" />
                <Button
                  variant="outline"
                  onClick={() => {
                    const blob = new Blob([sampleCsv], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "id_cards_template.csv";
                    a.click();
                  }}
                >
                  Download CSV template
                </Button>
                {bulk.length > 0 && (
                  <Button onClick={downloadAllZip}>Download all as ZIP ({bulk.length})</Button>
                )}
              </div>
              <div className="border-t pt-3 mt-2 space-y-2">
                <h3 className="font-semibold text-sm">Upload Student Photos (ZIP)</h3>
                <p className="text-xs text-muted-foreground">
                  ZIP containing images named by admission number (e.g., 1883.jpg, 1884.png). Supported: JPG, PNG, JPEG.
                </p>
                <Input type="file" accept=".zip" onChange={handlePhotoZip} className="max-w-sm" />
                {photoStats && (
                  <div className="flex flex-wrap gap-4 text-xs pt-1">
                    <span className="font-semibold">Total: {photoStats.total}</span>
                    <span className="text-green-700 font-semibold">Matched: {photoStats.matched}</span>
                    <span className="text-destructive font-semibold">Missing: {missingPhotos.length}</span>
                  </div>
                )}
                {missingPhotos.length > 0 && (
                  <div className="text-xs text-destructive">
                    Missing images for: {missingPhotos.join(", ")}
                  </div>
                )}
              </div>
            </Card>

            {csvHeaders.length > 0 && (
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="font-bold">Map CSV Columns</h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMapping(autoGuessMapping(csvHeaders))}
                    >
                      Auto-detect
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMapping({});
                        try {
                          localStorage.removeItem(MAPPING_STORAGE_KEY);
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      Clear
                    </Button>
                    <Button size="sm" onClick={applyMapping}>
                      Apply &amp; Generate ({csvRows.length})
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Detected {csvHeaders.length} columns. Match each ID card field to a column from your CSV. Required fields are marked with *.
                </p>
                <CsvColumnMapper
                  headers={csvHeaders}
                  mapping={mapping}
                  onChange={setMapping}
                />
                {previewRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      Preview (first {previewRows.length} rows)
                    </div>
                    <div className="overflow-x-auto border rounded-md">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left px-2 py-1.5 font-semibold">Name</th>
                            <th className="text-left px-2 py-1.5 font-semibold">Adm No.</th>
                            <th className="text-left px-2 py-1.5 font-semibold">Class</th>
                            <th className="text-left px-2 py-1.5 font-semibold">Father</th>
                            <th className="text-left px-2 py-1.5 font-semibold">Mobile</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((r, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-2 py-1">{r.studentName || "—"}</td>
                              <td className="px-2 py-1">{r.admissionNumber || "—"}</td>
                              <td className="px-2 py-1">{r.className || "—"}</td>
                              <td className="px-2 py-1">{r.fatherName || "—"}</td>
                              <td className="px-2 py-1">{r.mobileNumber || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {bulk.length > 0 && (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="font-bold">Generated Cards ({bulk.length})</h2>
                  <Button onClick={downloadAllZip}>Download all as ZIP</Button>
                </div>
                <div ref={bulkRef} className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {bulk.map((s, i) => {
                    const safeName = (s.studentName || `student_${i + 1}`).replace(/[^a-z0-9_-]+/gi, "_");
                    const downloadCardPng = async () => {
                      const front = bulkRef.current?.querySelector<HTMLElement>(`#bulk-front-${i}`);
                      const back = bulkRef.current?.querySelector<HTMLElement>(`#bulk-back-${i}`);
                      if (front) await downloadPng(front, `${safeName}_front.png`);
                      if (back) await downloadPng(back, `${safeName}_back.png`);
                      toast.success("PNG downloaded");
                    };
                    const downloadCardPdf = async () => {
                      const front = bulkRef.current?.querySelector<HTMLElement>(`#bulk-front-${i}`);
                      const back = bulkRef.current?.querySelector<HTMLElement>(`#bulk-back-${i}`);
                      if (front && back) {
                        await downloadPdf(front, back, `${safeName}_id.pdf`);
                        toast.success("PDF downloaded");
                      }
                    };
                    return (
                      <div key={i} className="flex flex-col items-center gap-3 p-3 border rounded-lg">
                        <div className="text-sm font-semibold text-center">
                          {s.studentName || `Student ${i + 1}`}
                          <span className="block text-xs text-muted-foreground font-normal">
                            Adm: {s.admissionNumber || "—"}
                          </span>
                        </div>
                        <IdCardFront data={s} exportId={`bulk-front-${i}`} />
                        <IdCardBack data={s} exportId={`bulk-back-${i}`} />
                        <div className="flex gap-2 flex-wrap justify-center pt-1">
                          <Button size="sm" onClick={downloadCardPng}>PNG</Button>
                          <Button size="sm" variant="secondary" onClick={downloadCardPdf}>PDF</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
