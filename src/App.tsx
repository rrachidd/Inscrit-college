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
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
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
  id: string;
}

interface RegistrationFormInput {
  firstName: string;
  lastName: string;
  gradeLevel: string;
  phone: string;
  address: string;
  chosenSchool: string;
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

const Directions = ({ origin, destination }: { origin: google.maps.LatLngLiteral; destination: google.maps.LatLngLiteral }) => {
  const map = useMap();
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!map) return;
    setDirectionsService(new google.maps.DirectionsService());
    const renderer = new google.maps.DirectionsRenderer({ 
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#2563eb',
        strokeWeight: 5,
        strokeOpacity: 0.7
      }
    });
    setDirectionsRenderer(renderer);
    return () => renderer.setMap(null);
  }, [map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer) return;

    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.WALKING
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          directionsRenderer.setDirections(result);
        } else {
          console.error("Directions Request Failed:", status);
          if (status === 'REQUEST_DENIED') {
            // Silently fail or could show a toast: "Please enable Directions API"
          }
          directionsRenderer.setDirections({ routes: [] } as any);
        }
      }
    );
  }, [directionsService, directionsRenderer, origin, destination]);

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

const RegistrationsTable = ({ registrations, isAdmin }: { registrations: RegistrationData[], isAdmin: boolean }) => {
  if (!isAdmin || registrations.length === 0) return null;

  return (
    <div className="mt-12 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-50 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          تتبع جميع التسجيلات (للمسؤول)
        </h2>
        <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
          {registrations.length} تسجيل إجمالي
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500 font-bold">
            <tr>
              <th className="px-6 py-4">التلميذ</th>
              <th className="px-6 py-4">المستوى</th>
              <th className="px-6 py-4">الهاتف</th>
              <th className="px-6 py-4">المؤسسة المختارة</th>
              <th className="px-6 py-4">الحالة</th>
              <th className="px-6 py-4">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {registrations.map((reg) => (
              <tr key={reg.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-semibold text-gray-800">
                  {reg.firstName} {reg.lastName}
                </td>
                <td className="px-6 py-4 text-gray-600">{reg.gradeLevel}</td>
                <td className="px-6 py-4 text-gray-600 font-mono">{reg.phone}</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1.5 font-medium text-blue-600">
                    <Building2 className="w-3.5 h-3.5" />
                    {reg.chosenSchool}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-bold border border-green-100">
                    <CheckCircle2 className="w-3 h-3" />
                    تم الإرسال
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-400 text-xs text-left" dir="ltr">
                  {reg.createdAt?.toDate ? reg.createdAt.toDate().toLocaleString('ar-MA') : 'قيد المعالجة'}
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
  selectedSchool, 
  onSuccess 
}: { 
  selectedSchool: string; 
  onSuccess: () => void;
}) => {
  const [formData, setFormData] = useState<RegistrationFormInput>({
    firstName: '',
    lastName: '',
    gradeLevel: 'السنة الأولى إعدادي',
    phone: '',
    address: '',
    chosenSchool: selectedSchool
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(prev => ({ ...prev, chosenSchool: selectedSchool }));
  }, [selectedSchool]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.chosenSchool) {
      setError('الرجاء اختيار إعدادية من القائمة');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await addDoc(collection(db, 'registrations'), {
        ...formData,
        createdAt: serverTimestamp()
      });
      setFormData({
        firstName: '',
        lastName: '',
        gradeLevel: 'السنة الأولى إعدادي',
        phone: '',
        address: '',
        chosenSchool: selectedSchool
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

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-600">الإعدادية المختارة</label>
          <input 
            readOnly 
            type="text" 
            value={formData.chosenSchool || 'الرجاء اختيار إعدادية من الخريطة'} 
            className={`w-full px-3 py-2 border rounded-lg text-sm bg-gray-100 ${!formData.chosenSchool ? 'border-red-300 text-red-500 font-bold' : 'border-gray-200 text-gray-800'}`}
          />
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

const ADMIN_EMAILS = ['rrachidv4@gmail.com'];
const ADMIN_LOCAL_USER = 'admin';
const ADMIN_LOCAL_PASS = 'Mhamid2024';

export default function App() {
  const [viewRole, setViewRole] = useState<'landing' | 'admin' | 'user' | 'admin_gate'>(() => {
    // Check if we previously selected a role to avoid landing page on refresh if desirable
    // For now, let's start fresh
    return 'landing';
  });
  const [isAdminGatePassed, setIsAdminGatePassed] = useState(false);
  const [adminGateData, setAdminGateData] = useState({ username: '', password: '' });
  const [adminGateError, setAdminGateError] = useState('');

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const isAdmin = useMemo(() => user && ADMIN_EMAILS.includes(user.email || ''), [user]);
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

    if (isAdmin) {
      // Fetch all registrations for admin
      const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
      unsubscribeRegistrations = onSnapshot(q, (snapshot) => {
        const regs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as RegistrationData));
        setUserRegistrations(regs);
      }, (error) => {
        console.error("Registrations snapshot error:", error);
      });

      // Calculate global stats for admin
      const qAll = query(collection(db, 'registrations'));
      unsubscribeStats = onSnapshot(qAll, (snapshot) => {
        const stats: Record<string, number> = {};
        snapshot.docs.forEach(d => {
          const data = d.data();
          const school = data.chosenSchool;
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
  }, [user, isAdmin]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery) return;
    setLoading(true);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery + ', المحاميد, مراكش, المغرب' }, (results, status) => {
      setLoading(false);
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location.toJSON();
        setUserLocation(loc);
      } else {
        console.warn('Geocoding failed:', status);
        // Fallback or alert
        if (status === 'REQUEST_DENIED') {
          alert('خدمة البحث عن العناوين غير مفعلة في مفتاح API. يمكنك النقر يدوياً على الخريطة.');
        } else {
          alert('لم يتم العثور على العنوان في منطقة المحاميد');
        }
      }
    });
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
        alert('فشل في تحديد الموقع الحالي');
        setLoading(false);
      }
    );
  };

  // Calculate distances when user location changes
  useEffect(() => {
    if (!userLocation) return;
    
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
        // Force select the nearest school when location is set
        setSelectedSchool(sorted[0]);
      } else {
        console.warn('Distance Matrix failed or not enabled:', status);
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
        // Force select the nearest school
        setSelectedSchool(sorted[0]);
      }
    });
  }, [userLocation]);

  if (viewRole === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-2xl shadow-slate-200/50 p-8 border border-white"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-100">
              <SchoolIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 mb-2">منصة تسجيل التلاميذ</h1>
            <p className="text-slate-500 text-sm">الرجاء اختيار نوع الدخول للمتابعة</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => setViewRole('admin_gate')}
              className="w-full group relative overflow-hidden bg-slate-900 text-white p-6 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">فضاء المسؤول</p>
                  <p className="text-xs text-white/50">تتبع وإدارة التسجيلات (يتطلب دخول)</p>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blue-600/20 transition-all"></div>
            </button>

            <button 
              onClick={() => setViewRole('user')}
              className="w-full group relative overflow-hidden bg-white border-2 border-slate-100 p-6 rounded-2xl transition-all hover:border-blue-200 hover:bg-blue-50/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-800">فضاء التلميذ</p>
                  <p className="text-xs text-slate-400">التسجيل وتتبع المؤسسات التعليمية</p>
                </div>
              </div>
            </button>
          </div>

          <p className="text-center mt-8 text-[10px] text-slate-400 font-bold uppercase tracking-widest">المحاميد - مراكش</p>
        </motion.div>
      </div>
    );
  }

  if (viewRole === 'admin_gate') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100"
        >
          <button 
            onClick={() => setViewRole('landing')}
            className="mb-6 flex items-center gap-2 text-slate-400 hover:text-slate-800 transition-colors text-sm font-bold"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            رجوع
          </button>

          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-800">دخول المسؤول</h2>
            <p className="text-sm text-slate-500">أدخل معلومات الحساب الخاصة بالمسؤولية</p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (adminGateData.username === ADMIN_LOCAL_USER && adminGateData.password === ADMIN_LOCAL_PASS) {
                setViewRole('admin');
                setIsAdminGatePassed(true);
              } else {
                setAdminGateError('اسم المستخدم أو كلمة المرور غير صحيحة');
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">اسم المستخدم</label>
              <input 
                type="text" 
                value={adminGateData.username}
                onChange={e => setAdminGateData({...adminGateData, username: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="admin"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">كلمة المرور</label>
              <input 
                type="password" 
                value={adminGateData.password}
                onChange={e => setAdminGateData({...adminGateData, password: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {adminGateError && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2 border border-red-100">
                <AlertCircle className="w-4 h-4" />
                {adminGateError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg"
            >
              تأكيد الدخول
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans" dir="rtl">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="ar">
        
        {/* Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 bottom-0 right-0 w-80 bg-white z-[70] shadow-2xl flex flex-col p-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Menu className="w-5 h-5 text-blue-600" />
                    القائمة الرئيسية
                  </h2>
                  <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        setShowStatsModal(true);
                        setIsSidebarOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-4 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <BarChart3 className="w-5 h-5" />
                        <span className="font-bold">إحصائيات التسجيل</span>
                      </div>
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -rotate-180 transition-all" />
                    </button>
                  )}

                  <div className="pt-4 border-t border-gray-100 mt-4">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4">معلومات الحساب</p>
                    {user ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="" />
                          <div>
                            <p className="text-sm font-bold truncate max-w-[150px]">{user.displayName}</p>
                            <p className="text-[10px] text-gray-500 font-medium">{user.email}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => signOut(auth)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all text-sm font-bold"
                        >
                          <LogOut className="w-4 h-4" />
                          تسجيل الخروج
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                        className="w-full bg-slate-800 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                      >
                        <User className="w-5 h-5" />
                        دخول المسؤول
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-auto pt-8">
                  {isAdmin && (
                    <div className="bg-slate-900 rounded-2xl p-4 text-white">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-blue-400">إجمالي المسجلين</span>
                      </div>
                      <p className="text-3xl font-black">{(Object.values(globalStats) as number[]).reduce((a, b) => a + b, 0)}</p>
                      <p className="text-[10px] opacity-60 mt-1">تلميذ مسجل في منطقة المحاميد</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Stats Modal */}
        <AnimatePresence>
          {showStatsModal && (
            <div className="fixed inset-0 z-[100] flex justify-center items-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowStatsModal(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-6 h-6" />
                    <h2 className="text-xl font-bold">إحصائيات الإعداديات</h2>
                  </div>
                  <button onClick={() => setShowStatsModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-4">
                    {SCHOOLS.map(school => (
                      <div key={school.id} className="group">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-bold text-gray-700">{school.name}</span>
                          <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            {globalStats[school.name] || 0} تلميذ
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, ((globalStats[school.name] || 0) / (Math.max(...(Object.values(globalStats) as number[]), 1))) * 100)}%` }}
                            className="h-full bg-blue-600 rounded-full shadow-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">يتم التحديث لحظياً عند كل عملية تسجيل جديدة</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2.5 hover:bg-gray-100 rounded-xl transition-all"
              >
                <Menu className="w-6 h-6 text-gray-700" />
              </button>
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200 hidden sm:block">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">إعداديتي القريبة</h1>
                  <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    منطقة المحاميد - مراكش
                  </p>
                </div>
              </div>
            </div>

                    <div className="flex items-center gap-2">
              {viewRole === 'admin' && (
                user ? (
                  <div className="flex items-center gap-3 bg-gray-50 pr-4 pl-1 py-1 rounded-full border border-gray-200">
                    <div className="text-left hidden sm:block">
                      <p className="text-[10px] font-black text-blue-600 uppercase leading-none mb-0.5 tracking-tighter">
                        {isAdmin ? 'المسؤول' : 'مستخدم'}
                      </p>
                      <p className="text-xs font-bold text-gray-700 leading-none">{user.displayName}</p>
                    </div>
                    <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" />
                  </div>
                ) : (
                  <button 
                    onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                    className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-slate-900 transition-all"
                  >
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">دخول المسؤول</span>
                  </button>
                )
              )}
              
              <button 
                onClick={() => {
                  setViewRole('landing');
                  setIsAdminGatePassed(false);
                  setAdminGateData({ username: '', password: '' });
                }}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="الرجوع للقائمة"
              >
                <ArrowRight className="w-5 h-5 rotate-180" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          <div className="grid lg:grid-cols-12 gap-8">
            
            {/* Sidebar (Search & Controls) */}
            <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
              
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                  <Search className="w-5 h-5 text-blue-600" />
                  تحديد موقع السكن
                </h2>
                
                <div className="space-y-4">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      placeholder="ابحث عن عنوانك (مثال: بوعكاز)"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button 
                      onClick={handleSearch}
                      className="absolute left-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={getCurrentLocation}
                      className="flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl border border-blue-100 hover:bg-blue-100 transition-all"
                    >
                      <Navigation2 className="w-4 h-4" />
                      موقعي الحالي
                    </button>
                    <button 
                      onClick={() => setIsManualPicking(!isManualPicking)}
                      className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                        isManualPicking 
                          ? 'bg-amber-100 text-amber-700 border-amber-300 ring-2 ring-amber-200 shadow-sm' 
                          : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'
                      }`}
                    >
                      <MapPin className={`w-4 h-4 ${isManualPicking ? 'animate-bounce' : ''}`} />
                      {isManualPicking ? 'انقر على الخريطة' : 'تحديد يدوي'}
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <Info className="w-5 h-5 text-amber-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                      حدد موقعك على الخريطة وسنقوم بترتيب الإعداديات القريبة منك وحساب مدة المشي الفعلية.
                    </p>
                    <p className="text-[9px] text-amber-600 font-bold">
                      ملاحظة: تأكد من تفعيل Distance Matrix API و Geocoding API في لوحة تحكم Google Cloud.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">الإعداديات المتاحة</h2>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{schoolsWithInfo.length || SCHOOLS.length} مدرسة</span>
                </div>
                
                <div className="h-[400px] overflow-y-auto pr-1 space-y-1 custom-scrollbar">
                  {((schoolsWithInfo.length > 0 ? schoolsWithInfo : SCHOOLS) as (SchoolData & { distance?: string; duration?: string })[]).map((school) => (
                    <SchoolCard 
                      key={school.id}
                      school={school}
                      isActive={selectedSchool?.id === school.id}
                      distance={school.distance}
                      duration={school.duration}
                      onClick={() => setSelectedSchool(school)}
                    />
                  ))}
                </div>
              </section>
            </div>

            {/* Map & Registration Form Area */}
            <div className="lg:col-span-8 flex flex-col gap-6 order-1 lg:order-2">
              
              {/* Map Container */}
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 h-[500px] relative overflow-hidden">
                    <Map
                      defaultCenter={MHAMID_CENTER}
                      defaultZoom={15}
                      gestureHandling="greedy"
                      zoomControl={true}
                      mapTypeControl={false}
                      streetViewControl={false}
                      fullscreenControl={false}
                      mapId="MAIN_MAP"
                      onClick={e => {
                        if (e.detail.latLng) {
                          setUserLocation(e.detail.latLng);
                          setIsManualPicking(false);
                        }
                      }}
                    >
                      {/* Camera Management */}
                      {selectedSchool ? (
                        <CameraHandler center={{ lat: selectedSchool.lat, lng: selectedSchool.lng }} zoom={16} />
                      ) : userLocation ? (
                        <CameraHandler center={userLocation} />
                      ) : null}

                      {userLocation && selectedSchool && (
                      <Directions 
                        origin={userLocation} 
                        destination={{ lat: selectedSchool.lat, lng: selectedSchool.lng }} 
                      />
                    )}
                    {isManualPicking && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
                        <div className="bg-amber-600 text-white px-4 py-2 rounded-full shadow-lg font-bold text-xs animate-pulse flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          انقر على موقع منزلك في الخريطة
                        </div>
                      </div>
                    )}
                  {userLocation && (
                    <Marker 
                      position={userLocation} 
                      title="موقعك"
                      icon={{
                        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                      }}
                    />
                  )}
                  {SCHOOLS.map(s => (
                    <Marker 
                      key={s.id} 
                      position={{lat: s.lat, lng: s.lng}} 
                      title={s.name}
                      onClick={() => setSelectedSchool(s)}
                    />
                  ))}
                </Map>
                
                {loading && (
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] flex justify-center items-center">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                )}
              </div>

              {/* Registration Form / Success State */}
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-green-600 p-8 rounded-2xl text-white text-center shadow-xl flex flex-col items-center gap-4"
                  >
                    <CheckCircle2 className="w-16 h-16" />
                    <div>
                      <h2 className="text-3xl font-bold mb-2">تم التسجيل بنجاح!</h2>
                      <p className="opacity-90">سيتواصل معك الطاقم الإداري للإعدادية {selectedSchool?.name} في أقرب وقت.</p>
                    </div>
                    <button 
                      onClick={() => {
                        setIsSuccess(false);
                      }}
                      className="mt-4 px-8 py-2 bg-white text-green-600 rounded-full font-bold hover:bg-green-50 transition-colors"
                    >
                      تسجيل جديد
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <RegistrationForm 
                      selectedSchool={selectedSchool?.name || ''} 
                      onSuccess={() => setIsSuccess(true)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

          <RegistrationsTable registrations={userRegistrations} isAdmin={isAdmin && viewRole === 'admin'} />
        </main>

        <footer className="max-w-7xl mx-auto px-8 py-12 text-center text-gray-400 text-xs">
          <p>© 2026 إعداديتي القريبة - نظام التوجيه المدرسي الذكي لمنطقة المحاميد</p>
          <p className="mt-2">جميع الحقوق محفوظة - مقاطعة المنارة مراكش</p>
        </footer>

      </APIProvider>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
