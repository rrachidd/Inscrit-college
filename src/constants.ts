export interface SchoolData {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address: string;
  type: string;
}

export const SCHOOLS: SchoolData[] = [
  { id: 1, name: "إعدادية المحاميد 10", lat: 31.6320, lng: -8.0250, address: "جماعة سعاده، منطقة المحاميد، مقاطعة المنارة، مراكش", type: "إعدادية" },
  { id: 3, name: "إعدادية التقدم", lat: 31.591080, lng: -8.025128, address: "شارع بوعكاز، المحاميد، مراكش", type: "إعدادية" },
  { id: 4, name: "إعدادية المسيرة الثانية", lat: 31.594922, lng: -8.058176, address: "المسيرة، مقاطعة المنارة، مراكش", type: "إعدادية" },
  { id: 5, name: "إعدادية علال الفاسي", lat: 31.582895, lng: -8.056015, address: "منطقة المحاميد، مراكش", type: "إعدادية" },
  { id: 6, name: "إعدادية العربي بن صديق", lat: 31.588039, lng: -8.059008, address: "مراكش 40160", type: "إعدادية" },
  { id: 7, name: "إعدادية الضحى", lat: 31.585547, lng: -8.047863, address: "مراكش 40160", type: "إعدادية" },
  { id: 8, name: "إعدادية طارق بن زياد", lat: 31.592052, lng: -8.033955, address: "المحاميد 1، مراكش", type: "إعدادية" },
  { id: 9, name: "إعدادية إدريس بنزكري", lat: 31.601510, lng: -8.039750, address: "مقاطعة المنارة، مراكش", type: "إعدادية" },
  { id: 10, name: "إعدادية الأطلس", lat: 31.602719, lng: -8.051217, address: "شارع سجلماسة، مراكش", type: "إعدادية" },
  { id: 11, name: "ثانوية النهضة الإعدادية", lat: 31.596387, lng: -8.043653, address: "المحاميد، مراكش", type: "إعدادية" },
  { id: 12, name: "إعدادية غاندي", lat: 31.582706, lng: -8.032965, address: "منطقة المحاميد، مراكش", type: "إعدادية" }
];

export const MHAMID_CENTER = { lat: 31.6300, lng: -8.0250 };
export const GOOGLE_MAPS_API_KEY = "AIzaSyCFKTh5hUvvd2aePABMJifZpRngKD7Ido0";
