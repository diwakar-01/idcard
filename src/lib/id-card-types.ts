export type StudentData = {
  // Front
  studentName: string;
  className: string;
  transportType: string;
  busNumber: string;
  busStop: string;
  busStopDetail: string;
  houseName: string;
  admissionNumber: string;
  barcodeValue: string;
  photoDataUrl?: string;
  // Back
  fatherName: string;
  motherName: string;
  mobileNumber: string;
  dob: string;
  bloodGroup: string;
  address: string;
  qrData: string;
  signatureDataUrl?: string;
};

export const emptyStudent = (): StudentData => ({
  studentName: "",
  className: "",
  transportType: "SCHOOL BUS",
  busNumber: "",
  busStop: "",
  busStopDetail: "",
  houseName: "",
  admissionNumber: "",
  barcodeValue: "",
  fatherName: "",
  motherName: "",
  mobileNumber: "",
  dob: "",
  bloodGroup: "",
  address: "",
  qrData: "",
});

export const SCHOOL_INFO = {
  name: "Delhi Public School, Chas",
  tagline: "A CBSE Affiliated Day-Cum-Residential School",
  address: "Chas-Chandankyari Road, Chas, Bokaro-827013, Jharkhand",
  mobile: "8986614061/62",
  website: "www.dpschasbokaro.com",
};

export function formatDOB(input: string): string {
  // Accept yyyy-mm-dd or already formatted
  if (!input) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-");
    return `${d}/${m}/${y}`;
  }
  return input;
}

export function formatPhone(input: string): string {
  return (input || "").replace(/\D/g, "").slice(0, 10);
}
