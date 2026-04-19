import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
};

export const STUDENT_FIELDS: FieldDef[] = [
  { key: "studentName", label: "Student Name", required: true },
  { key: "admissionNumber", label: "Admission Number", required: true },
  { key: "className", label: "Class" },
  { key: "transportType", label: "Transport Type" },
  { key: "busNumber", label: "Bus Number" },
  { key: "busStop", label: "Bus Stop" },
  { key: "busStopDetail", label: "Bus Stop Detail" },
  { key: "houseName", label: "House Name" },
  { key: "barcodeValue", label: "Barcode Value" },
  { key: "fatherName", label: "Father Name" },
  { key: "motherName", label: "Mother Name" },
  { key: "mobileNumber", label: "Mobile Number" },
  { key: "dob", label: "Date of Birth" },
  { key: "bloodGroup", label: "Blood Group" },
  { key: "address", label: "Address" },
  { key: "qrData", label: "QR Code Data" },
];

const NONE = "__none__";

export type ColumnMapping = Record<string, string>;

export function autoGuessMapping(headers: string[]): ColumnMapping {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const map: ColumnMapping = {};
  const aliases: Record<string, string[]> = {
    studentName: ["studentname", "name", "fullname", "student"],
    admissionNumber: ["admissionnumber", "admissionno", "admno", "admissionid", "admission", "admno", "admno.", "admissionno."],
    className: ["classname", "class", "grade", "standard"],
    transportType: ["transporttype", "transport", "mode"],
    busNumber: ["busnumber", "busno", "bus"],
    busStop: ["busstop", "stop"],
    busStopDetail: ["busstopdetail", "stopdetail", "landmark"],
    houseName: ["housename", "house"],
    barcodeValue: ["barcodevalue", "barcode"],
    fatherName: ["fathername", "father", "fname"],
    motherName: ["mothername", "mother", "mname"],
    mobileNumber: ["mobilenumber", "mobile", "phone", "contact"],
    dob: ["dob", "dateofbirth", "birthdate"],
    bloodGroup: ["bloodgroup", "blood"],
    address: ["address", "addr"],
    qrData: ["qrdata", "qr"],
  };
  const normalizedHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  for (const f of STUDENT_FIELDS) {
    const candidates = aliases[f.key] || [];
    const found = normalizedHeaders.find((h) => candidates.includes(h.n));
    if (found) map[f.key] = found.raw;
  }
  return map;
}

export function CsvColumnMapper({
  headers,
  mapping,
  onChange,
}: {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {STUDENT_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label className="text-xs font-semibold">
            {f.label} {f.required && <span className="text-destructive">*</span>}
          </Label>
          <Select
            value={mapping[f.key] || NONE}
            onValueChange={(v) => {
              const next = { ...mapping };
              if (v === NONE) delete next[f.key];
              else next[f.key] = v;
              onChange(next);
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select column…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— None —</SelectItem>
              {headers.map((h) => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
