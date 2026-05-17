import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  APIProvider, 
  Map, 
  Marker, 
  InfoWindow, 
  useApiIsLoaded, 
  useMap 
} from '@vis.gl/react-google-maps';
import { 
  School as SchoolIcon, 
  Search, 
  MapPin, 
  Navigation, 
  Navigation2, 
  Info, 
  ArrowRight, 
  User, 
  LogOut, 
  CheckCircle2, 
  Phone, 
  GraduationCap, 
  Home, 
  Building2,
  AlertCircle,
  Loader2,
  Menu,
  X,
  BarChart3,
  Users,
  ShieldCheck,
  Trash2,
  Edit3,
  MessageCircle,
  ExternalLink,
  PieChart as PieChartIcon,
  Activity,
  TrendingUp,
  LayoutDashboard,
  ChevronDown,
  Printer,
  Filter,
  Link as LinkIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LabelList 
} from 'recharts';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  signInAnonymously,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocFromServer, 
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  getDocs
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { SCHOOLS, MHAMID_CENTER, GOOGLE_MAPS_API_KEY, SchoolData } from './constants';

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface RegistrationData extends RegistrationFormInput {
  authorId?: string;
  authorEmail?: string;
  createdAt: any;
  updatedAt?: any;
  deletedAt?: any;
  id: string;
  isAccepted?: boolean;
  acceptedSchool?: string;
}

interface RegistrationFormInput {
  firstName: string;
  lastName: string;
  gradeLevel: string;
  phone: string;
  address: string;
  chosenSchool: string;
  choice1: string;
  choice2: string;
  choice3: string;
}

// --- Utils ---

const calculateHaversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const CameraHandler = ({ center, zoom }: { center: google.maps.LatLngLiteral | null; zoom?: number }) => {
  const map = useMap();
  useEffect(() => {
    if (map && center) {
      map.panTo(center);
      if (zoom) map.setZoom(zoom);
    }
  }, [map, center, zoom]);
  return null;
};

const Directions = ({ origin, destination, onDenied, isDenied }: { origin: google.maps.LatLngLiteral; destination: google.maps.LatLngLiteral; onDenied?: () => void; isDenied?: boolean }) => {
  const map = useMap();
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localDenied, setLocalDenied] = useState(() => localStorage.getItem('google_maps_directions_denied') === 'true');

  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map) return;
    try {
      if (!isDenied && !localDenied) {
        setDirectionsService(new google.maps.DirectionsService());
      }
      const renderer = new google.maps.DirectionsRenderer({ 
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 6,
          strokeOpacity: 0.8
        }
      });
      setDirectionsRenderer(renderer);

      const line = new google.maps.Polyline({
        map,
        strokeColor: '#3b82f6',
        strokeWeight: 4,
        strokeOpacity: 0.6,
        visible: false
      });
      setPolyline(line);
    } catch (e) {
      console.warn("Directions Service initialization skipped or failed.");
    }
    return () => {
      if (directionsRenderer) directionsRenderer.setMap(null);
      if (polyline) polyline.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    if (!directionsRenderer || !polyline) return;

    if (isDenied || localDenied) {
      directionsRenderer.setDirections({ routes: [] } as any);
      polyline.setPath([origin, destination]);
      polyline.setVisible(true);
      return;
    }

    if (!directionsService) return;

    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.WALKING
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
          polyline.setVisible(false);
          setError(null);
        } else {
          // Fallback to straight line
          directionsRenderer.setDirections({ routes: [] } as any);
          polyline.setPath([origin, destination]);
          polyline.setVisible(true);

          if (status === 'REQUEST_DENIED') {
            localStorage.setItem('google_maps_directions_denied', 'true');
            setLocalDenied(true);
            onDenied?.();
          } else {
            console.warn("Directions Request Failed:", status);
          }
          setError(status);
        }
      }
    );
  }, [directionsService, directionsRenderer, polyline, origin, destination, isDenied, localDenied, onDenied]);

  return null;
};

const SchoolCard = ({ 
  school, 
  distance, 
  duration, 
  isActive, 
  onClick 
}: { 
  key?: React.Key;
  school: SchoolData; 
  distance?: string; 
  duration?: string; 
  isActive: boolean; 
  onClick: () => void;
}) => {
  const getBadgeColor = (distValue: number) => {
    if (distValue < 0.5) return 'bg-green-100 text-green-800';
    if (distValue < 1.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getBadgeText = (distValue: number) => {
    if (distValue < 0.5) return 'قريب جداً';
    if (distValue < 1.5) return 'متوسط';
    return 'بعيد';
  };

  const distVal = distance ? parseFloat(distance) : 0;

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`p-4 rounded-xl border-r-4 transition-all cursor-pointer mb-3 shadow-sm ${
        isActive 
          ? 'bg-blue-50 border-blue-600 ring-1 ring-blue-200' 
          : 'bg-white border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-blue-600" />
          {school.name}
        </h3>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${getBadgeColor(distVal)}`}>
          {getBadgeText(distVal)}
        </span>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Navigation className="w-3 h-3" />
          <span>المسافة: {distance || 'جاري الحساب...'}</span>
        </div>
        {duration && (
          <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
            <Navigation2 className="w-3 h-3" />
            <span>وقت المشي: {duration}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-2">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{school.address}</span>
        </div>
      </div>
    </motion.div>
  );
};

const AdminDashboard = ({ registrations, userRole, staffSchool, globalStats }: { registrations: RegistrationData[], userRole: 'admin' | 'staff' | 'landing', staffSchool: string | null, globalStats: Record<string, number> }) => {
  const schoolCount = SCHOOLS.map(school => ({
    name: school.name,
    count: globalStats[school.name] || 0
  })).filter(s => userRole === 'admin' || s.name === staffSchool);

  const totalGlobal = userRole === 'staff' && staffSchool 
    ? (globalStats[staffSchool] || 0)
    : Object.values(globalStats).reduce((a, b) => a + b, 0);

  const gradeCount = [
    { name: 'الأولى', count: registrations.filter(r => r.gradeLevel === 'السنة الأولى إعدادي').length },
    { name: 'الثانية', count: registrations.filter(r => r.gradeLevel === 'السنة الثانية إعدادي').length },
    { name: 'الثالثة', count: registrations.filter(r => r.gradeLevel === 'السنة الثالثة إعدادي').length },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-8 py-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-black text-slate-800">
          {userRole === 'admin' ? 'لوحة تحكم المسؤول' : (staffSchool ? `فضاء: ${staffSchool}` : 'لوحة تحكم المساعد')}
        </h2>
        <div className="flex items-center gap-3">
          {userRole === 'admin' && !auth.currentUser && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold animate-pulse">
              <AlertCircle className="w-4 h-4" />
              <span>يجب ربط حساب Google للقيام بالتعديلات</span>
            </div>
          )}
          <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-sm ${
            userRole === 'admin' ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
          }`}>
            {userRole === 'admin' ? 'Full Access' : 'View Only Mode'}
          </span>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400">إجمالي التلاميذ</p>
              <p className="text-2xl font-black text-slate-800">{registrations.length}</p>
            </div>
          </div>
          <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full w-[70%]" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-50 rounded-2xl">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400">
                {userRole === 'staff' ? 'المؤسسة الحالية' : 'توزيع المؤسسات'}
              </p>
              <p className="text-2xl font-black text-slate-800">
                {userRole === 'staff' ? '1' : SCHOOLS.length}
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
            <div className="bg-green-600 h-full w-[85%]" />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-2xl">
              <Activity className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-400">الطلبات النشطة</p>
              <p className="text-2xl font-black text-slate-800">{registrations.length}</p>
            </div>
          </div>
          <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
            <div className="bg-amber-600 h-full w-[60%]" />
          </div>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              توزيع التلاميذ حسب المؤسسة
            </h3>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={schoolCount}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <RechartsTooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: any) => [`${value} تلميذ (${((Number(value) / (totalGlobal || 1)) * 100).toFixed(1)}%)`, 'العدد']}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32}>
                  <LabelList 
                    dataKey="count" 
                    position="top" 
                    style={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                    formatter={(value: any) => value > 0 ? value : ''}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-green-500" />
              توزيع المستويات الدراسية
            </h3>
          </div>
          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gradeCount}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  label={({ name, percent }) => percent > 0 ? `${(percent * 100).toFixed(0)}%` : ''}
                >
                  {gradeCount.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: any) => [`${value} تلميذ (${((Number(value) / (registrations.length || 1)) * 100).toFixed(1)}%)`, 'العدد']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {gradeCount.map((g, i) => {
              const percentage = ((g.count / (registrations.length || 1)) * 100).toFixed(1);
              return (
                <div key={g.name} className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i]}} />
                    <span className="text-[10px] font-bold text-slate-500">{g.name}</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-400">{g.count} ({percentage}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Popular Schools Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <h3 className="font-black text-slate-800">إحصائيات المؤسسات التفصيلية</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-black text-slate-400">المؤسسة</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400">عدد التلاميذ</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {schoolCount.sort((a, b) => b.count - a.count).map((s) => (
                <tr key={s.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{s.name}</td>
                  <td className="px-6 py-4 font-mono text-sm">{s.count}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-bold">نشط</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const RegistrationsTable = ({ 
  registrations, 
  userRole, 
  staffSchool,
  onEdit, 
  onDelete,
  filterSchool,
  setFilterSchool,
  filterGrade,
  setFilterGrade,
  filterStatus,
  setFilterStatus
}: { 
  registrations: RegistrationData[], 
  userRole: 'admin' | 'staff' | 'landing',
  staffSchool: string | null,
  onEdit: (reg: RegistrationData) => void,
  onDelete: (id: string) => void,
  filterSchool: string,
  setFilterSchool: (s: string) => void,
  filterGrade: string,
  setFilterGrade: (g: string) => void,
  filterStatus: string,
  setFilterStatus: (s: any) => void
}) => {
  if (userRole === 'landing') return null;

  const canEditDelete = userRole === 'admin';

  const handlePrint = () => {
    const currentSchool = userRole === 'staff' ? staffSchool : (filterSchool !== 'all' ? filterSchool : 'جميع المؤسسات');
    const currentGrade = filterGrade !== 'all' ? filterGrade : 'جميع المستويات';

    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) {
      alert('المرجو السماح بالنوافذ المنبثقة (Pop-ups) لتتمكن من الطباعة');
      return;
    }

    const html = `
      <html dir="rtl">
        <head>
          <title>لائحة التلاميذ - ${currentSchool}</title>
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
            body { font-family: 'Tajawal', sans-serif; padding: 30px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; }
            .header h1 { margin: 0; color: #1e40af; font-size: 26px; }
            .header h2 { margin: 10px 0; color: #2563eb; font-size: 20px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; border: 2px solid #cbd5e1; padding: 12px; text-align: right; }
            td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-size: 13px; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 40px; text-align: left; font-size: 12px; color: #64748b; font-style: italic; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>المملكة المغربية - لائحة التلاميذ</h1>
            <h2>المؤسسة: ${currentSchool}</h2>
            <p style="margin:5px 0;">السنة الدراسية: 2024 / 2025</p>
          </div>
          <div class="meta">
            <span>المستوى: ${currentGrade}</span>
            <span>عدد التلاميذ: ${registrations.length}</span>
            <span>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-MA')}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">رقم</th>
                <th>الاسم العائلي</th>
                <th>الاسم الشخصي</th>
                <th>المستوى</th>
                <th>رقم الهاتف</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${registrations.map((reg, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${reg.lastName}</td>
                  <td>${reg.firstName}</td>
                  <td>${reg.gradeLevel}</td>
                  <td dir="ltr">${reg.phone}</td>
                  <td>${reg.isAccepted ? 'مقبول' : 'في الإنتظار'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            تم استخراج هذه اللائحة من منظومة التسجيل الإلكتروني - محاميد
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                // Optionally close after print dialog
                // window.close(); 
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleAccept = async (reg: RegistrationData, school: string) => {
    try {
      const docRef = doc(db, 'registrations', reg.id);
      await updateDoc(docRef, {
        isAccepted: true,
        acceptedSchool: school,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error accepting registration:", error);
      handleFirestoreError(error, OperationType.UPDATE, `registrations/${reg.id}`);
    }
  };

  const handleWhatsApp = (reg: RegistrationData, selectedSchool: string) => {
    const message = `السلام عليكم ورحمة الله،\n\nنخبركم أنه تم قبول ملف التلميذ(ة) ${reg.firstName} ${reg.lastName} للتسجيل في ${selectedSchool} للموسم الدراسي المقبل.\n\nالمرجو الالتحاق بالمؤسسة لاستكمال إجراءات التسجيل.\n\nمع التحية.`;
    const encodedMessage = encodeURIComponent(message);
    let phone = reg.phone.replace(/\s+/g, '');
    if (phone.startsWith('0')) {
      phone = '212' + phone.substring(1);
    } else if (!phone.startsWith('212') && !phone.startsWith('+')) {
      phone = '212' + phone;
    }
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const WhatsAppMenu = ({ reg }: { reg: RegistrationData }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // For staff, they only see accepted registrations for their school, so the target school is clear
    const displaySchool = userRole === 'staff' ? (staffSchool || reg.acceptedSchool || reg.chosenSchool) : (reg.acceptedSchool || reg.chosenSchool);

    if (userRole === 'staff') {
      return (
        <button 
          onClick={() => handleWhatsApp(reg, displaySchool)}
          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
          title="مراسلة واتساب"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-[10px] font-bold">مراسلة</span>
        </button>
      );
    }

    const choices = [reg.choice1, reg.choice2, reg.choice3].filter(Boolean);
    const currentSchool = reg.acceptedSchool || reg.chosenSchool;

    return (
      <div className="relative">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
          title="مراسلة واتساب"
        >
          <MessageCircle className="w-4 h-4" />
          <ChevronDown className="w-3 h-3" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 bottom-full mb-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden py-1">
              <div className="px-3 py-1.5 text-[9px] uppercase font-bold text-gray-400 bg-gray-50/50">اختر المؤسسة للمراسلة:</div>
              <button
                onClick={() => {
                  handleWhatsApp(reg, currentSchool);
                  setIsOpen(false);
                }}
                className="w-full text-right px-4 py-2 text-xs hover:bg-green-50 text-green-700 font-bold transition-colors block border-b border-gray-50"
              >
                {currentSchool} {reg.isAccepted ? '(المقبولة)' : '(المختارة)'}
              </button>
              {choices.filter(c => c !== currentSchool).map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    handleWhatsApp(reg, choice);
                    setIsOpen(false);
                  }}
                  className="w-full text-right px-4 py-2 text-xs hover:bg-blue-50 text-gray-700 transition-colors block border-b border-gray-50 last:border-0"
                >
                  {choice}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="mt-12 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            {userRole === 'admin' ? 'تتبع جميع التسجيلات (للمسؤول)' : 'لائحة التسجيلات (للمساعد)'}
          </h2>
          <p className="text-[10px] text-gray-400 font-medium mr-7">
            {userRole === 'admin' ? 'لديك صلاحيات كاملة للتعديل والحذف والفلطرة' : 'وضع المساعد: يمكنك المراسلة والطباعة'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {userRole === 'admin' && (
            <>
              <div className="relative">
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <select 
                  value={filterSchool}
                  onChange={(e) => setFilterSchool(e.target.value)}
                  className="pr-9 pl-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none min-w-[140px]"
                >
                  <option value="all">جميع المؤسسات</option>
                  {SCHOOLS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div className="relative">
                <GraduationCap className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <select 
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="pr-9 pl-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none min-w-[120px]"
                >
                  <option value="all">جميع المستويات</option>
                  <option value="السنة الأولى إعدادي">الأولى إعدادي</option>
                  <option value="السنة الثانية إعدادي">الثانية إعدادي</option>
                  <option value="السنة الثالثة إعدادي">الثالثة إعدادي</option>
                </select>
              </div>

              <div className="relative">
                <Activity className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pr-9 pl-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none min-w-[120px]"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="accepted">تم القبول</option>
                  <option value="pending">في انتظار</option>
                </select>
              </div>
            </>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-xl text-[11px] font-bold hover:bg-blue-700 transition-all shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            طباعة اللائحة
          </button>

          <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
            {registrations.length} تسجيل
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500 font-bold">
            <tr>
              <th className="px-6 py-4">التلميذ</th>
              <th className="px-6 py-4">المستوى</th>
              <th className="px-6 py-4">الهاتف</th>
              <th className="px-6 py-4">{userRole === 'admin' ? 'الاختيارات والقبول' : 'المؤسسة المقبولة'}</th>
              <th className="px-6 py-4">الحالة</th>
              <th className="px-6 py-4">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {registrations.map((reg) => (
              <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-800">{reg.firstName} {reg.lastName}</div>
                  <div className="text-[10px] text-gray-400 mt-1">تاريخ الطلب: {reg.createdAt?.toDate ? reg.createdAt.toDate().toLocaleDateString('ar-MA') : '...'}</div>
                </td>
                <td className="px-6 py-4 text-gray-600">{reg.gradeLevel}</td>
                <td className="px-6 py-4 text-gray-600 font-mono" dir="ltr">{reg.phone}</td>
                <td className="px-6 py-4">
                  {userRole === 'admin' ? (
                    <div className="flex flex-col gap-1.5 min-w-[200px]">
                      {[reg.choice1, reg.choice2, reg.choice3].filter(Boolean).map((choice, idx) => {
                        const isThisAccepted = reg.isAccepted && reg.acceptedSchool === choice;
                        return (
                          <div key={idx} className={`flex items-center justify-between p-1.5 rounded-lg border ${isThisAccepted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                            <span className={`text-[10px] font-bold ${isThisAccepted ? 'text-green-700' : 'text-gray-500'}`}>
                              {idx + 1}. {choice}
                            </span>
                            {!isThisAccepted && (
                              <button
                                onClick={() => handleAccept(reg, choice as string)}
                                className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-md hover:bg-blue-700 transition-colors"
                              >
                                قبول
                              </button>
                            )}
                            {isThisAccepted && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5 font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                      <Building2 className="w-3.5 h-3.5" />
                      {reg.acceptedSchool}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${reg.isAccepted ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                    {reg.isAccepted ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        تم القبول
                      </>
                    ) : (
                      <>
                        <Activity className="w-3 h-3" />
                        في الانتظار
                      </>
                    )}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <WhatsAppMenu reg={reg} />
                    
                    {canEditDelete && (
                      <>
                        <button 
                          onClick={() => onEdit(reg)}
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                          title="تعديل"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(reg.id);
                          }}
                          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RegistrationForm = ({ 
  selectedSchools, 
  onSuccess 
}: { 
  selectedSchools: string[]; 
  onSuccess: () => void;
}) => {
  const [formData, setFormData] = useState<RegistrationFormInput>({
    firstName: '',
    lastName: '',
    gradeLevel: 'السنة الأولى إعدادي',
    phone: '',
    address: '',
    chosenSchool: selectedSchools[0] || '',
    choice1: selectedSchools[0] || '',
    choice2: selectedSchools[1] || '',
    choice3: selectedSchools[2] || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(prev => ({ 
      ...prev, 
      chosenSchool: selectedSchools[0] || '',
      choice1: selectedSchools[0] || '',
      choice2: selectedSchools[1] || '',
      choice3: selectedSchools[2] || ''
    }));
  }, [selectedSchools]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.chosenSchool) {
      setError('الرجاء اختيار إعدادية من القائمة');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cleanFormData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== undefined)
      );
      await addDoc(collection(db, 'registrations'), {
        ...cleanFormData,
        createdAt: serverTimestamp()
      });
      setFormData({
        firstName: '',
        lastName: '',
        gradeLevel: 'السنة الأولى إعدادي',
        phone: '',
        address: '',
        chosenSchool: selectedSchools[0] || '',
        choice1: selectedSchools[0] || '',
        choice2: selectedSchools[1] || '',
        choice3: selectedSchools[2] || ''
      });
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError('حدث خطأ أثناء التسجيل. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-blue-600" />
        تسجيل التلميذ
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">الاسم الشخصي</label>
            <input 
              required
              type="text" 
              value={formData.firstName}
              onChange={e => setFormData({...formData, firstName: e.target.value})}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="محمد"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">الاسم العائلي</label>
            <input 
              required
              type="text" 
              value={formData.lastName}
              onChange={e => setFormData({...formData, lastName: e.target.value})}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="العلوي"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">المستوى الدراسي</label>
          <select 
            value={formData.gradeLevel}
            onChange={e => setFormData({...formData, gradeLevel: e.target.value})}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            <option>السنة الأولى إعدادي</option>
            <option>السنة الثانية إعدادي</option>
            <option>السنة الثالثة إعدادي</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">رقم الهاتف</label>
          <div className="relative">
            <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input 
              required
              type="tel" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
              placeholder="06XXXXXXXX"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">عنوان السكن</label>
          <div className="relative">
            <Home className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input 
              required
              type="text" 
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="المحاميد 9، الشطر..."
            />
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
            <p className="text-[10px] font-bold text-blue-600 mb-2 uppercase tracking-wider">الإعداديات الثلاث الأقرب (تلقائياً)</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-blue-200">
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                <span className="text-xs font-bold text-gray-800">{formData.choice1 || '...'}</span>
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-blue-200">
                <span className="w-5 h-5 bg-blue-400 text-white rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                <span className="text-xs font-bold text-gray-800">{formData.choice2 || '...'}</span>
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-blue-200">
                <span className="w-5 h-5 bg-blue-300 text-white rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
                <span className="text-xs font-bold text-gray-800">{formData.choice3 || '...'}</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 p-3 rounded-lg border border-red-100">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <button 
          disabled={loading || !formData.chosenSchool}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد التسجيل'}
        </button>
      </form>
    </div>
  );
};

const EditRegistrationModal = ({ 
  registration, 
  onClose, 
  onUpdate 
}: { 
  registration: RegistrationData, 
  onClose: () => void, 
  onUpdate: (id: string, data: Partial<RegistrationFormInput>) => Promise<void> 
}) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gradeLevel: '',
    phone: '',
    address: '',
    chosenSchool: '',
    choice1: '',
    choice2: '',
    choice3: '',
    ...registration 
  });
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onUpdate(registration.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        gradeLevel: formData.gradeLevel,
        phone: formData.phone,
        address: formData.address,
        chosenSchool: formData.chosenSchool,
        choice1: formData.choice1 || '',
        choice2: formData.choice2 || '',
        choice3: formData.choice3 || ''
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      let msg = "حدث خطأ أثناء التحديث. تأكد من صلاحياتك.";
      try {
        const info = JSON.parse(err.message);
        if (info.error?.includes("permission-denied") || info.error?.includes("insufficient permissions")) {
          msg = "تم رفض الوصول: يجب ربط حساب Google الخاص بك والتوفر على صلاحيات المسؤول.";
        }
      } catch (e) {}
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">تعديل بيانات التلميذ</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">الاسم الشخصي</label>
              <input 
                type="text" 
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">الاسم العائلي</label>
              <input 
                type="text" 
                value={formData.lastName}
                onChange={e => setFormData({...formData, lastName: e.target.value})}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">المستوى الدراسي</label>
            <select 
              value={formData.gradeLevel}
              onChange={e => setFormData({...formData, gradeLevel: e.target.value})}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>السنة الأولى إعدادي</option>
              <option>السنة الثانية إعدادي</option>
              <option>السنة الثالثة إعدادي</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">رقم الهاتف</label>
            <input 
              type="tel" 
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              dir="ltr"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">العنوان</label>
            <input 
              type="text" 
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">الإعدادية</label>
            <select 
              value={formData.chosenSchool}
              onChange={e => setFormData({...formData, chosenSchool: e.target.value})}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SCHOOLS.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 disabled:bg-blue-300 transition-all"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ADMIN_EMAILS = ['rrachidv4@gmail.com'];
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Mhamid2024';
const STAFF_USER = 'staff';
const STAFF_PASS = 'Staff2024';

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Removed alert for cleaner UX
  throw new Error(JSON.stringify(errInfo));
}

const ManualModal = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex justify-center items-center p-4 overflow-y-auto" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden my-auto"
      >
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white">
          <div className="flex items-center gap-3">
            <Info className="w-6 h-6" />
            <h2 className="text-2xl font-black">دليل الاستخدام وملاحظات هامة</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
        
        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* User Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-black text-blue-600 flex items-center gap-2">
              <Users className="w-5 h-5" />
              أولاً: دليل التلميذ/ولي الأمر
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-black text-slate-400 block mb-1">الخطوة 1</span>
                <p className="text-sm font-bold text-slate-700">تحديد الموقع: ابحث عن عنوان سكنك أو استعمل خاصية تحديد الموقع التلقائي.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-black text-slate-400 block mb-1">الخطوة 2</span>
                <p className="text-sm font-bold text-slate-700">اختيار المؤسسة: ستظهر لك أقرب الإعداديات مع حساب المسافة والزمن اللازم مشياً.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-black text-slate-400 block mb-1">الخطوة 3</span>
                <p className="text-sm font-bold text-slate-700">التسجيل: املأ الاستمارة بعناية، مع اختيار 3 رغبات للمؤسسات المفضلة.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-black text-slate-400 block mb-1">الخطوة 4</span>
                <p className="text-sm font-bold text-slate-700">المتابعة: سيتم التواصل معكم عبر الواتساب فور معالجة طلبكم من طرف الإدارة.</p>
              </div>
            </div>
          </section>

          {/* Personnel Section */}
          <section className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-lg font-black text-orange-600 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              ثانياً: فضاء المسؤول والمساعد
            </h3>
            <div className="space-y-3">
              <div className="flex gap-4 p-4 bg-orange-50 rounded-3xl border border-orange-100">
                <div className="p-2 bg-orange-100 rounded-xl h-fit">
                  <LayoutDashboard className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">لوحة التحكم (Dashboard)</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">تتيح للمسؤول رؤية إحصائيات عامة حول عدد التسجيلات في كل مؤسسة وتوزيع المستويات الدراسية.</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-blue-50 rounded-3xl border border-blue-100">
                <div className="p-2 bg-blue-100 rounded-xl h-fit">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">تدبير التسجيلات</h4>
                  <ul className="text-xs text-slate-500 leading-relaxed mt-2 list-disc list-inside space-y-1">
                    <li><span className="font-bold text-slate-700">الفلترة:</span> يمكن فرز التلاميذ حسب المؤسسة، المستوى الدراسي، أو حالة الطلب (مقبول/في الانتظار).</li>
                    <li><span className="font-bold text-slate-700">القبول:</span> يتم قبول الطلب بتحديد المؤسسة النهائية وإرسال إشعار للمستفيد.</li>
                    <li><span className="font-bold text-slate-700">التواصل:</span> زر الواتساب يتيح مراسلة ولي الأمر برسالة جاهزة تتضمن معلومات القبول.</li>
                    <li><span className="font-bold text-slate-700">الطباعة:</span> يمكن استخراج لوائح التلاميذ للمؤسسة المختارة بسهولة.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Critical Notes */}
          <section className="p-6 bg-red-50 rounded-[2rem] border border-red-100 space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-black">ملاحظات تقنية هامة</h3>
            </div>
            <ul className="text-xs text-red-700 space-y-2 font-bold">
              <li className="flex gap-2"><span>•</span> <span>يجب توفر اتصال جيد بالإنترنت لضمان مزامنة البيانات والخرائط.</span></li>
              <li className="flex gap-2"><span>•</span> <span>للحصول على صلاحيات المسؤول الكاملة، يجب تسجيل الدخول بحساب Google المعتمد.</span></li>
              <li className="flex gap-2"><span>•</span> <span>تأكد من السماح بالنوافذ المنبثقة (Pop-ups) في المتصفح لاستخدام ميزة الطباعة.</span></li>
            </ul>
          </section>
        </div>

        <div className="p-8 bg-slate-50 flex justify-center">
          <button 
            onClick={onClose}
            className="px-12 py-3 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl"
          >
            فهمت، إغلاق الدليل
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [isPortalIsolated] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('portal');
  });

  const [viewRole, setViewRole] = useState<'landing' | 'admin_dashboard' | 'user' | 'admin_gate'>(() => {
    const params = new URLSearchParams(window.location.search);
    const portal = params.get('portal');
    if (portal === 'admin') return 'admin_gate';
    if (portal === 'user') return 'user';
    return 'landing';
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (viewRole === 'user') {
      params.set('portal', 'user');
    } else if (viewRole === 'admin_gate' || viewRole === 'admin_dashboard') {
      params.set('portal', 'admin');
    } else {
      params.delete('portal');
    }
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', newUrl);
  }, [viewRole]);
  const [activeAdminTab, setActiveAdminTab] = useState<'registrations' | 'dashboard'>('dashboard');
  const [adminLocalRole, setAdminLocalRole] = useState(false);
  const [staffRole, setStaffRole] = useState(false);
  const [staffSchool, setStaffSchool] = useState<string | null>(null);
  const [adminGateData, setAdminGateData] = useState({ username: '', password: '' });
  const [adminGateError, setAdminGateError] = useState('');

  const [user, setUser] = useState<FirebaseUser | null>(null);
  
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<SchoolData | null>(null);
  const [schoolsWithInfo, setSchoolsWithInfo] = useState<(SchoolData & { distance?: string; duration?: string; distanceValue?: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRegistrations, setUserRegistrations] = useState<RegistrationData[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalStats, setGlobalStats] = useState<Record<string, number>>({});
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [isManualPicking, setIsManualPicking] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState<RegistrationData | null>(null);
  const [distanceServiceDenied, setDistanceServiceDenied] = useState(() => localStorage.getItem('google_maps_distance_denied') === 'true');
  const [directionsServiceDenied, setDirectionsServiceDenied] = useState(() => localStorage.getItem('google_maps_directions_denied') === 'true');
  const [filterSchool, setFilterSchool] = useState<string>('all');
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'accepted' | 'pending'>('all');
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  const [showManual, setShowManual] = useState(false);

  const userRole = useMemo(() => {
    if (adminLocalRole) return 'admin';
    if (staffRole) return 'staff';
    if (user && ADMIN_EMAILS.includes(user.email || '')) return 'admin';
    return 'landing';
  }, [user, staffRole, adminLocalRole]);

  const filteredRegistrations = useMemo(() => {
    let list = userRegistrations;
    
    // For staff, we only show registrations for their school
    // but we can allow them to see pending ones that CHOSE their school as first choice?
    // Actually, usually staff should only see accepted. But let's keep it flexible if they are searching.
    if (userRole === 'staff' && staffSchool) {
      list = list.filter(r => (r.isAccepted && r.acceptedSchool === staffSchool) || (!r.isAccepted && r.chosenSchool === staffSchool));
    }

    if (filterSchool !== 'all') {
      list = list.filter(r => (r.acceptedSchool || r.chosenSchool) === filterSchool);
    }

    if (filterGrade !== 'all') {
      list = list.filter(r => r.gradeLevel === filterGrade);
    }

    if (filterStatus === 'accepted') {
      list = list.filter(r => r.isAccepted);
    } else if (filterStatus === 'pending') {
      list = list.filter(r => !r.isAccepted);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        r.firstName.toLowerCase().includes(q) || 
        r.lastName.toLowerCase().includes(q) || 
        r.phone.includes(q)
      );
    }

    return list;
  }, [userRegistrations, userRole, staffSchool, filterSchool, filterGrade, filterStatus, searchQuery]);

  const filteredStats = useMemo(() => {
    if (userRole === 'admin') return globalStats;
    if (userRole === 'staff' && staffSchool) {
      return { [staffSchool]: globalStats[staffSchool] || 0 };
    }
    return globalStats;
  }, [globalStats, userRole, staffSchool]);

  const hasAdminAccess = userRole === 'admin' || userRole === 'staff';

  const handleDeleteRegistration = async (id: string) => {
    try {
      const docRef = doc(db, 'registrations', id);
      await deleteDoc(docRef);
      // Removed success alert
      setUserRegistrations(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error("Delete error for ID:", id, err);
      handleFirestoreError(err, OperationType.DELETE, `registrations/${id}`);
    }
  };

  const handleUpdateRegistration = async (id: string, data: Partial<RegistrationFormInput>) => {
    try {
      const docRef = doc(db, 'registrations', id);
      // We must ensure updatedAt is provided as the rules require it
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `registrations/${id}`);
    }
  };

  // Auth observer
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        getDocFromServer(doc(db, 'test', 'connection')).catch(() => {});
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Data fetching effect based on user/admin status
  useEffect(() => {
    let unsubscribeRegistrations = () => {};
    let unsubscribeStats = () => {};

    if (hasAdminAccess) {
      // Fetch all registrations for admin/staff
      const q = query(
        collection(db, 'registrations'), 
        where('deletedAt', '==', null),
        orderBy('createdAt', 'desc')
      );
      // Wait: Firestore won't let you mix where null and orderby without index, 
      // let's simplify for now or handle missing index
      const qSimple = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
      unsubscribeRegistrations = onSnapshot(qSimple, (snapshot) => {
        const regs = snapshot.docs
          .map(d => ({
            id: d.id,
            ...d.data()
          } as RegistrationData))
          .filter(r => !r.deletedAt);
        setUserRegistrations(regs);
        setFirestoreError(null);
      }, (error) => {
        console.error("Registrations snapshot error:", error);
        if (error.code === 'unavailable') {
          setFirestoreError("جاري الاتصال بقاعدة البيانات... المرجو التحقق من صبيب الإنترنت");
        } else {
          setFirestoreError(error.message);
        }
      });

      // Calculate global stats for admin
      const qAll = query(collection(db, 'registrations'));
      unsubscribeStats = onSnapshot(qAll, (snapshot) => {
        const stats: Record<string, number> = {};
        snapshot.docs.forEach(d => {
          const data = d.data() as RegistrationData;
          if (data.deletedAt) return;
          const school = data.acceptedSchool || data.chosenSchool;
          if (school) {
            stats[school] = (stats[school] || 0) + 1;
          }
        });
        setGlobalStats(stats);
      });
    } else {
      // For normal users, we don't show stats or registrations
      setUserRegistrations([]);
      setGlobalStats({});
    }

    return () => {
      unsubscribeRegistrations();
      unsubscribeStats();
    };
  }, [user, hasAdminAccess]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery) return;

    // Prioritize school name matching
    const q = searchQuery.trim().toLowerCase();
    const matchedSchool = SCHOOLS.find(s => 
      s.name.toLowerCase().includes(q) || 
      q.includes(s.name.toLowerCase())
    );

    if (matchedSchool) {
      setSelectedSchool(matchedSchool);
      return;
    }

    setLoading(true);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery + ', المحاميد, مراكش, المغرب' }, (results, status) => {
      setLoading(false);
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location.toJSON();
        setUserLocation(loc);
      } else {
        console.warn('Geocoding failed:', status);
        // Removed alerts for cleaner UX
      }
    });
  }, [searchQuery]);

  // Real-time school search for immediate feedback on the map
  useEffect(() => {
    if (searchQuery.length < 3) return;
    
    const q = searchQuery.trim().toLowerCase();
    // Try to find an exact match or a very strong match
    const exactMatch = SCHOOLS.find(s => 
      s.name.toLowerCase() === q || 
      s.name.toLowerCase().replace('إعدادية ', '') === q
    );

    if (exactMatch) {
      setSelectedSchool(exactMatch);
    }
  }, [searchQuery]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      () => {
        console.warn('Geolocation failed');
        setLoading(false);
      }
    );
  };

  // Calculate distances when user location changes
  useEffect(() => {
    if (!userLocation) return;
    
    if (distanceServiceDenied) {
      // Direct fallback if already denied
      const info = SCHOOLS.map(s => {
        const distKm = calculateHaversine(userLocation.lat, userLocation.lng, s.lat, s.lng);
        return {
          ...s,
          distance: distKm.toFixed(2) + ' كم',
          duration: Math.round(distKm * 12) + ' دقيقة', // Approx 5km/h walking
          distanceValue: distKm * 1000
        };
      });
      const sorted = info.sort((a, b) => (a.distanceValue || 0) - (b.distanceValue || 0));
      setSchoolsWithInfo(sorted);
      setSelectedSchool(sorted[0]);
      return;
    }

    try {
      const service = new google.maps.DistanceMatrixService();
      const destinations = SCHOOLS.map(s => ({ lat: s.lat, lng: s.lng }));

      service.getDistanceMatrix({
        origins: [userLocation],
        destinations: destinations,
        travelMode: google.maps.TravelMode.WALKING,
      }, (response, status) => {
        if (status === 'OK' && response) {
          const info = response.rows[0].elements.map((el, i) => ({
            ...SCHOOLS[i],
            distance: el.distance?.text,
            duration: el.duration?.text,
            distanceValue: el.distance?.value
          }));
          
          const sorted = info.sort((a, b) => (a.distanceValue || 0) - (b.distanceValue || 0));
          setSchoolsWithInfo(sorted);
          setSelectedSchool(sorted[0]);
        } else {
          if (status === 'REQUEST_DENIED') {
            localStorage.setItem('google_maps_distance_denied', 'true');
            setDistanceServiceDenied(true);
          } else {
            console.warn('Distance Matrix failed:', status);
          }
          // Fallback to Haversine calculation
          const info = SCHOOLS.map(s => {
            const distKm = calculateHaversine(userLocation.lat, userLocation.lng, s.lat, s.lng);
            return {
              ...s,
              distance: distKm.toFixed(2) + ' كم',
              duration: Math.round(distKm * 12) + ' دقيقة', // Approx 5km/h walking
              distanceValue: distKm * 1000
            };
          });
          const sorted = info.sort((a, b) => (a.distanceValue || 0) - (b.distanceValue || 0));
          setSchoolsWithInfo(sorted);
          setSelectedSchool(sorted[0]);
        }
      });
    } catch (e) {
      setDistanceServiceDenied(true);
    }
  }, [userLocation, distanceServiceDenied]);

  const copyLink = (portal: 'user' | 'admin') => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('portal', portal);
    navigator.clipboard.writeText(url.toString());
    alert(`تم نسخ رابط ${portal === 'user' ? 'فضاء التلميذ' : 'فضاء المسؤول'} بنجاح`);
  };

  if (viewRole === 'landing') {
    return (
      <div className="min-h-screen launcher-bg flex items-center justify-center p-6 text-right overflow-hidden" dir="rtl">
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* User Portal */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="group relative overflow-hidden bg-white/10 backdrop-blur-xl rounded-[3rem] shadow-2xl p-10 border border-white/10 flex flex-col items-center text-center hover:bg-white/20 transition-all cursor-pointer"
            onClick={() => setViewRole('user')}
          >
            <div className="w-24 h-24 bg-white text-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl group-hover:scale-110 transition-transform">
              <GraduationCap className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4">فضاء التلميذ</h2>
            <p className="text-blue-100/60 text-sm font-medium mb-10 leading-relaxed">
              تسجيل التلاميذ الجدد، متابعة حالة الطلب، وتحديد المؤسسة الأقرب لسكنكم عبر الخريطة التفاعلية.
            </p>
            <div className="w-full flex flex-col gap-3">
              <button 
                onClick={(e) => { e.stopPropagation(); setViewRole('user'); }}
                className="w-full py-5 bg-white text-blue-900 rounded-2xl font-black text-lg shadow-xl shadow-blue-900/20 hover:bg-blue-50 transition-colors"
              >
                دخول المستخدم
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); copyLink('user'); }}
                className="flex items-center justify-center gap-2 text-white/50 hover:text-white transition-colors text-xs font-bold"
              >
                <LinkIcon className="w-4 h-4" />
                نسخ رابط مباشر لهذا الفضاء
              </button>
            </div>
          </motion.div>

          {/* Admin Portal */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="group relative overflow-hidden bg-slate-900/40 backdrop-blur-xl rounded-[3rem] shadow-2xl p-10 border border-white/10 flex flex-col items-center text-center hover:bg-slate-900/60 transition-all cursor-pointer"
            onClick={() => setViewRole('admin_gate')}
          >
            <div className="w-24 h-24 bg-blue-600 text-white rounded-3xl flex items-center justify-center mb-8 shadow-2xl group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4">فضاء المسؤول</h2>
            <p className="text-blue-100/60 text-sm font-medium mb-10 leading-relaxed">
              خاص بإدارة المؤسسات، تدبير تسجيلات التلاميذ، المصادقة على الطلبات، واستخراج اللوائح والإحصائيات.
            </p>
            <div className="w-full flex flex-col gap-3">
              <button 
                onClick={(e) => { e.stopPropagation(); setViewRole('admin_gate'); }}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-blue-700 transition-colors"
              >
                دخول الإدارة
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); copyLink('admin'); }}
                className="flex items-center justify-center gap-2 text-white/50 hover:text-white transition-colors text-xs font-bold"
              >
                <LinkIcon className="w-4 h-4" />
                نسخ رابط مباشر للمسؤول
              </button>
            </div>
          </motion.div>
        </div>

        {/* Global Footer Elements */}
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowManual(true); }}
            className="text-blue-200/50 hover:text-white transition-colors text-xs font-bold flex items-center gap-2"
          >
            <Info className="w-4 h-4" />
            دليل الاستخدام والملاحظات
          </button>
          <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">المحاميد - مراكش • 2026</p>
        </div>
      </div>
    );
  }

  if (viewRole === 'admin_gate') {
    return (
      <div className="min-h-screen launcher-bg flex items-center justify-center p-6" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-10 border border-white/10"
        >
          {!isPortalIsolated && (
            <button 
              onClick={() => setViewRole('landing')}
              className="mb-8 flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-bold"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              رجوع
            </button>
          )}

          <div className="mb-8">
            <h2 className="text-2xl font-black text-white">دخول النظام</h2>
            <p className="text-sm text-blue-100/60">أدخل معلومات الحساب للمتابعة</p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const schoolMatch = SCHOOLS.find(s => s.name === adminGateData.username || (s.staffUsername && s.staffUsername === adminGateData.username));
              
              if (adminGateData.username === ADMIN_USER && adminGateData.password === ADMIN_PASS) {
                setAdminLocalRole(true);
                setStaffRole(false);
                setStaffSchool(null);
                setViewRole('admin_dashboard');
              } else if (schoolMatch && (adminGateData.password === STAFF_PASS || (schoolMatch.staffPassword && adminGateData.password === schoolMatch.staffPassword))) {
                setStaffRole(true);
                setAdminLocalRole(false);
                setStaffSchool(schoolMatch.name);
                setViewRole('admin_dashboard');
              } else if (adminGateData.username === STAFF_USER && adminGateData.password === STAFF_PASS) {
                setStaffRole(true);
                setAdminLocalRole(false);
                setStaffSchool(null);
                setViewRole('admin_dashboard');
              } else {
                setAdminGateError('اسم المستخدم أو كلمة المرور غير صحيحة. استعمل معلومات الحساب المخصصة لمؤسستك.');
              }
            }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold text-blue-100/40 mr-2">اسم المستخدم</label>
              <input 
                type="text" 
                value={adminGateData.username}
                onChange={e => setAdminGateData({...adminGateData, username: e.target.value})}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-white/10"
                placeholder="admin"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-blue-100/40 mr-2">كلمة المرور</label>
              <input 
                type="password" 
                value={adminGateData.password}
                onChange={e => setAdminGateData({...adminGateData, password: e.target.value})}
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-white/10"
                placeholder="••••••••"
                required
              />
            </div>

            {adminGateError && (
              <div className="p-4 bg-red-500/20 text-red-200 text-xs rounded-2xl flex items-center gap-3 border border-red-500/20">
                <AlertCircle className="w-4 h-4" />
                {adminGateError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full py-5 bg-white text-blue-900 rounded-2xl font-black text-lg hover:shadow-2xl hover:shadow-blue-900/40 transition-all shadow-xl"
            >
              تأكيد الدخول
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${hasAdminAccess || viewRole === 'admin_gate' ? 'launcher-bg' : 'bg-slate-200'} text-gray-900 font-sans transition-colors duration-500`} dir="rtl">
      {firestoreError && (
        <div className="fixed top-0 inset-x-0 z-[200] bg-red-600 text-white text-[11px] font-black py-2 px-4 flex items-center justify-center gap-2 shadow-lg banner-animate">
          <AlertCircle className="w-4 h-4" />
          <span>{firestoreError}</span>
        </div>
      )}
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="ar">
        
        {/* Profile / Logout Widget (Floating) */}
        <AnimatePresence>
          {hasAdminAccess && viewRole !== 'user' && !(isPortalIsolated && userRole === 'staff') && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="fixed top-6 left-6 z-[100] flex flex-col items-center gap-2"
            >
              <div className="profile-card p-4 rounded-3xl flex flex-col items-center gap-2 shadow-2xl">
                <div className="w-16 h-16 rounded-full border-4 border-white/20 overflow-hidden shadow-inner flex items-center justify-center bg-white/10">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-white/50" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-sm">
                    {user?.displayName || (userRole === 'admin' ? 'مدير النظام' : 'مساعد النظام')}
                  </p>
                  {!user && (
                    <p className="text-amber-400 text-[8px] font-bold mt-0.5 px-2 py-0.5 bg-amber-400/10 rounded-full border border-amber-400/20">
                      يجب ربط حساب Google للقيام بالعمليات
                    </p>
                  )}
                  <p className="text-blue-200 text-[9px] font-bold mb-1 opacity-60">
                    {userRole === 'admin' ? 'مسؤول (Full Admin)' : 'مساعد (Staff User)'}
                  </p>
                  <div className="flex flex-col items-center gap-1 mt-1">
                    {userRole === 'admin' && !user && (
                      <button 
                        onClick={() => {
                          const provider = new GoogleAuthProvider();
                          signInWithPopup(auth, provider).catch(console.error);
                        }}
                        className="bg-blue-600 text-white text-[9px] px-3 py-1 rounded-full font-bold hover:bg-blue-700 transition-all flex items-center gap-1 mb-1"
                      >
                        <ShieldCheck className="w-2.5 h-2.5" />
                        ربط حساب Google
                      </button>
                    )}
                    {!isPortalIsolated && (
                      <button 
                        onClick={() => {
                          signOut(auth);
                          setStaffRole(false);
                          setAdminLocalRole(false);
                          setViewRole(isPortalIsolated ? 'admin_gate' : 'landing');
                        }}
                        className="text-orange-400 text-[10px] font-bold hover:text-orange-300 transition-colors"
                      >
                        تسجيل الخروج
                      </button>
                    )}
                    {!isPortalIsolated && (
                      <button 
                        onClick={() => {
                          setViewRole('landing');
                        }}
                        className="text-white/40 text-[9px] font-bold hover:text-white transition-colors flex items-center gap-1 px-2 py-0.5 rounded-lg border border-white/5"
                      >
                        <Home className="w-2.5 h-2.5" />
                        العودة للرئيسية
                      </button>
                    )}
                    <button 
                      onClick={() => setShowManual(true)}
                      className="text-blue-300/60 text-[9px] font-bold hover:text-blue-200 transition-colors flex items-center gap-1 mt-1"
                    >
                      <Info className="w-2.5 h-2.5" />
                      فتح دليل الاستخدام
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Section */}
        <header className="pt-12 pb-8 px-6 text-center">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-6">
            <h1 className="text-3xl font-black text-white flex items-center gap-3 drop-shadow-lg">
              <span>نظام إدارة التسجيلات</span>
              <Building2 className="w-8 h-8 text-blue-300" />
            </h1>
            <p className="text-blue-100/60 text-sm font-medium -mt-4">نظام التوجيه المدرسي بمنطقة المحاميد مراكش</p>

            <button 
              onClick={() => setShowManual(true)}
              className="orange-banner w-full max-w-2xl px-8 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shadow-lg"
            >
              <Info className="w-5 h-5 shrink-0" />
              <span>دليل الاستخدام وملاحظات</span>
            </button>

            {/* Corner Action Button */}
            {!isPortalIsolated && (
              <button 
                onClick={() => {
                  setAdminLocalRole(false);
                  setStaffRole(false);
                  setViewRole('landing');
                }}
                className="absolute top-8 left-8 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all group"
                title="تسجيل الخروج"
              >
                <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </button>
            )}

            {isPortalIsolated && (viewRole === 'user' || userRole === 'staff') && (
              <button 
                onClick={() => setShowManual(true)}
                className="absolute top-8 left-8 p-3 rounded-full bg-blue-600/30 text-white hover:bg-blue-600/50 transition-all flex items-center gap-2 px-4 shadow-lg backdrop-blur-md border border-white/10"
                title="دليل الاستخدام"
              >
                <Info className="w-5 h-5" />
                <span className="text-[10px] font-black">دليل الاستخدام</span>
              </button>
            )}
          </div>
        </header>

        <main className="max-w-5xl mx-auto p-6 md:p-8">
          {hasAdminAccess && viewRole === 'admin_dashboard' ? (
            <div className="space-y-12">
              {/* Launcher Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveAdminTab('dashboard')}
                  className={`launcher-button ${activeAdminTab === 'dashboard' ? 'active' : ''}`}
                >
                  <div className="p-3 rounded-xl bg-orange-100/10 active:bg-blue-100">
                    <LayoutDashboard className={`w-6 h-6 ${activeAdminTab === 'dashboard' ? 'text-blue-900' : 'text-white'}`} />
                  </div>
                  <div className="text-right">
                    <p className="text-lg">لوحة التحكم</p>
                    <p className="text-[10px] opacity-60">إحصائيات عامة للمؤسسات</p>
                  </div>
                </button>

                <button 
                  onClick={() => setActiveAdminTab('registrations')}
                  className={`launcher-button ${activeAdminTab === 'registrations' ? 'active' : ''}`}
                >
                  <div className="p-3 rounded-xl bg-blue-100/10">
                    <Users className={`w-6 h-6 ${activeAdminTab === 'registrations' ? 'text-blue-900' : 'text-white'}`} />
                  </div>
                  <div className="text-right">
                    <p className="text-lg">لائحة التلاميذ</p>
                    <p className="text-[10px] opacity-60">تدبير التسجيلات والمتابعة</p>
                  </div>
                </button>
              </div>

              {/* Dynamic Content Area */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeAdminTab}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white/95 backdrop-blur-md rounded-[2.5rem] shadow-2xl p-8 border border-white/20 min-h-[400px]"
                >
                  {activeAdminTab === 'dashboard' ? (
                    <AdminDashboard 
                      registrations={filteredRegistrations} 
                      userRole={userRole} 
                      staffSchool={staffSchool} 
                      globalStats={globalStats}
                    />
                  ) : (
                    <RegistrationsTable 
                      registrations={filteredRegistrations} 
                      userRole={userRole} 
                      staffSchool={staffSchool}
                      onEdit={setEditingRegistration}
                      onDelete={handleDeleteRegistration}
                      filterSchool={filterSchool}
                      setFilterSchool={setFilterSchool}
                      filterGrade={filterGrade}
                      setFilterGrade={setFilterGrade}
                      filterStatus={filterStatus}
                      setFilterStatus={setFilterStatus}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {!isPortalIsolated && (
                <div className="text-center pb-8 flex flex-col items-center gap-4">
                  <button 
                    onClick={() => {
                      setViewRole('landing');
                    }}
                    className="px-8 py-2.5 bg-white/5 border border-white/10 text-white/50 rounded-2xl text-xs font-bold hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 group"
                  >
                    <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    الرجوع للقائمة الرئيسية
                  </button>
                </div>
              )}

              {/* Extra Hero Section (Matching bottom of image) */}
              <div className="bg-[#1e3a8a] p-12 rounded-[3rem] text-center text-white border border-white/5 shadow-inner">
                <div className="flex flex-col items-center gap-6">
                  <div className="p-4 bg-white/10 rounded-2xl">
                    <SchoolIcon className="w-12 h-12 text-blue-200" />
                  </div>
                  <h2 className="text-5xl font-black leading-tight">نظام إدارة<br />التسجيلات</h2>
                  <p className="text-blue-100/80 max-w-xl mx-auto leading-relaxed">
                    نظام التوجيه المدرسي بمنطقة المحاميد مراكش
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
            <div className="space-y-8">
                {/* 1. تحديد موقع السكن */}
                <div className="max-w-xl mx-auto w-full">
                  <section className="bg-white p-6 rounded-3xl shadow-xl border border-blue-50">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                      <Search className="w-5 h-5 text-blue-600" />
                      تحديد موقع السكن
                    </h2>
                    <div className="space-y-4">
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="ابحث عن عنوانك (مثال: بوعكاز)"
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm focus:border-blue-500 outline-none transition-all"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={getCurrentLocation} className="flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 text-xs font-bold rounded-2xl hover:bg-blue-100 transition-all">
                          <Navigation2 className="w-4 h-4" />
                          موقعي
                        </button>
                        <button onClick={() => setIsManualPicking(!isManualPicking)} className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-600 text-xs font-bold rounded-2xl hover:bg-slate-100 transition-all border border-slate-100">
                          <MapPin className="w-4 h-4" />
                          تحديد يدوي
                        </button>
                      </div>
                    </div>
                  </section>
                </div>

                {/* 2. الخريطة */}
                <div className="map-container h-[400px]">
                  <Map defaultCenter={MHAMID_CENTER} defaultZoom={15} mapId="MAIN_MAP" onClick={e => { if (e.detail.latLng) setUserLocation(e.detail.latLng); setIsManualPicking(false); }}>
                    {selectedSchool ? <CameraHandler center={{ lat: selectedSchool.lat, lng: selectedSchool.lng }} zoom={16} /> : userLocation ? <CameraHandler center={userLocation} /> : null}
                    {userLocation && selectedSchool && (
                      <Directions 
                        origin={userLocation} 
                        destination={{ lat: selectedSchool.lat, lng: selectedSchool.lng }} 
                        onDenied={() => setDirectionsServiceDenied(true)}
                        isDenied={directionsServiceDenied}
                      />
                    )}
                    {userLocation && <Marker position={userLocation} title="موقعك" icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' }} />}
                    {SCHOOLS.map(s => <Marker key={s.id} position={{lat: s.lat, lng: s.lng}} title={s.name} onClick={() => setSelectedSchool(s)} />)}
                  </Map>
                </div>

                <div className="grid lg:grid-cols-12 gap-8 items-start">
                  {/* 3. تسجيل التلاميذ */}
                  <div className="lg:col-span-8">
                    <AnimatePresence mode="wait">
                      {isSuccess ? (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-green-600 p-12 rounded-[2.5rem] text-white text-center shadow-2xl flex flex-col items-center gap-6">
                          <CheckCircle2 className="w-20 h-20" />
                          <h2 className="text-4xl font-black">تم التسجيل بنجاح!</h2>
                          <button onClick={() => setIsSuccess(false)} className="px-12 py-3 bg-white text-green-600 rounded-full font-bold hover:bg-green-50 transition-colors shadow-lg">تسجيل جديد</button>
                        </motion.div>
                      ) : (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                          <RegistrationForm 
                            selectedSchools={schoolsWithInfo.slice(0, 3).map(s => s.name)} 
                            onSuccess={() => setIsSuccess(true)} 
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 4. الإعداديات المتاحة */}
                  <div className="lg:col-span-4 lg:sticky lg:top-8">
                    <section className="bg-white p-6 rounded-3xl shadow-xl border border-blue-50 max-h-[600px] overflow-hidden flex flex-col">
                      <h2 className="text-lg font-bold mb-4 text-slate-800">الإعداديات المتاحة</h2>
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                        {(distanceServiceDenied || directionsServiceDenied) && (
                          <div className="bg-amber-50 border border-amber-100 p-2 rounded-xl flex items-center gap-2 mb-3 text-amber-700 text-[9px] font-bold">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>محسوب تقريبياً لعدم توفر خرائط الطرق</span>
                          </div>
                        )}
                        {((schoolsWithInfo.length > 0 ? schoolsWithInfo : SCHOOLS) as any[]).map((school) => (
                          <SchoolCard key={school.id} school={school} isActive={selectedSchool?.id === school.id} distance={school.distance} duration={school.duration} onClick={() => setSelectedSchool(school)} />
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              </div>

              {!isPortalIsolated && (
                <div className="mt-12 flex justify-center">
                   <button 
                    onClick={() => setViewRole('landing')}
                    className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-2 shadow-xl hover:bg-slate-800 transition-all"
                  >
                    <ArrowRight className="w-5 h-5 rotate-180" />
                    رجوع للقائمة الرئيسية
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        <AnimatePresence>
          {editingRegistration && (
            <EditRegistrationModal 
              registration={editingRegistration}
              onClose={() => setEditingRegistration(null)}
              onUpdate={handleUpdateRegistration}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showManual && (
            <ManualModal onClose={() => setShowManual(false)} />
          )}
        </AnimatePresence>

        <footer className="py-12 border-t border-slate-100 text-center text-slate-400 text-xs bg-white">
          <p>© 2026 إعداديتي القريبة - نظام التوجيه المدرسي الذكي لمنطقة المحاميد</p>
          <div className="mt-4 flex justify-center gap-6 grayscale opacity-50">
            <GraduationCap className="w-6 h-6" />
            <Home className="w-6 h-6" />
            <Users className="w-6 h-6" />
          </div>
        </footer>

      </APIProvider>
    </div>
  );
}
