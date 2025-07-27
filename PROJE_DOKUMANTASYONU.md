# Akıllı Ev Dashboard Projesi - Detaylı Dokümantasyon

## 📋 Proje Genel Bakış

Bu proje, React ve Node.js tabanlı modern, responsive bir akıllı ev kontrol paneli uygulamasıdır. MQTT protokolü ile gerçek zamanlı iletişim, kullanıcı kimlik doğrulama ve kişiselleştirilmiş dashboard'lar sunarak kapsamlı IoT cihaz yönetimi sağlar.

### 🏷️ Temel Bilgiler
- **Proje Adı**: Smart Home Dashboard
- **Versiyon**: 1.0.0
- **Lisans**: MIT
- **Ana Teknolojiler**: React 18, Node.js, Express, MQTT, SQLite, TailwindCSS

## 🏗️ Proje Mimarisi

### Frontend Mimarisi
```
Frontend (React SPA)
├── React 18 (Modern Hooks & Functional Components)
├── React Router (Single Page Navigation)
├── Context API (Global State Management)
├── React Grid Layout (Drag & Drop Dashboard)
├── TailwindCSS (Utility-First Styling)
├── Socket.IO Client (Real-time Communication)
├── Lucide React (Icon Library)
└── Recharts (Data Visualization)
```

### Backend Mimarisi
```
Backend (Express Server)
├── Express.js (RESTful API)
├── Socket.IO (WebSocket Server)
├── MQTT.js (MQTT 5.0 Client)
├── SQLite3 (Local Database)
├── Express Session (Authentication)
├── bcrypt (Password Hashing)
├── Multer (File Upload)
└── fs-extra (File System Operations)
```

## 📁 Dosya Yapısı Analizi

### Kök Dizin
```
smarthome/
├── 📄 package.json              # Proje bağımlılıkları ve scriptler
├── 📄 server.js                 # Express server ana dosyası
├── 📄 webpack.config.js         # Webpack build konfigürasyonu
├── 📄 tailwind.config.js        # TailwindCSS konfigürasyonu
├── 📄 postcss.config.js         # PostCSS konfigürasyonu
├── 📄 database.sqlite           # SQLite veritabanı dosyası
├── 📄 README.md                 # İngilizce dokümantasyon
├── 📄 CLAUDE.md                 # AI asistan notları
└── 📄 test-mqtt-topics.md       # MQTT test konuları
```

### Source (src/) Dizini
```
src/
├── 📄 App.js                    # Ana React uygulaması
├── 📄 index.js                  # React DOM render noktası
├── 📄 index.html                # HTML template
│
├── 📁 components/               # React bileşenleri
│   ├── 📁 auth/                # Kimlik doğrulama bileşenleri
│   │   └── Login.js            # Giriş/kayıt formu
│   │
│   ├── 📁 devices/             # Cihaz bileşenleri
│   │   └── DeviceWidget.js     # Cihaz widget'ı
│   │
│   ├── 📁 layout/              # Layout bileşenleri
│   │   ├── Navbar.js           # Üst navigasyon
│   │   └── Sidebar.js          # Yan menü
│   │
│   └── 📁 ui/                  # UI bileşenleri
│       ├── DebugPanel.js       # Debug paneli
│       ├── DevicesDebug.js     # Cihaz debug paneli
│       └── Icon.js             # Icon wrapper
│
├── 📁 contexts/                 # React Context'leri
│   ├── AuthContext.js          # Kimlik doğrulama state
│   ├── DeviceContext.js        # Cihaz yönetimi state
│   ├── MqttContext.js          # MQTT bağlantı state
│   └── ThemeContext.js         # Tema yönetimi state
│
├── 📁 config/                   # Konfigürasyon dosyaları
│   ├── database.js             # Veritabanı işlemleri
│   ├── devices.json            # Cihaz tanımları
│   ├── bc.json                 # Broker konfigürasyonları
│   └── message-formats.json    # Mesaj formatları
│
├── 📁 pages/                    # Sayfa bileşenleri
│   ├── Dashboard.js            # Ana dashboard
│   ├── Devices.js              # Cihazlar sayfası
│   └── Settings.js             # Ayarlar sayfası
│
├── 📁 routes/                   # API route'ları
│   └── auth.js                 # Kimlik doğrulama API'leri
│
└── 📁 styles/                   # Stil dosyaları
    └── globals.css             # Global CSS
```

### Upload Dizini
```
uploads/
└── 📁 certificates/            # SSL/TLS sertifika dosyaları
    ├── ca-cert.pem            # CA sertifikası
    ├── client-cert.pem        # İstemci sertifikası
    └── client-key.pem         # Özel anahtar
```

## 🛠️ Teknoloji Stack Analizi

### Ana Bağımlılıklar (dependencies)
| Paket | Versiyon | Amaç |
|-------|----------|------|
| **express** | ^4.18.2 | Web sunucusu framework'ü |
| **socket.io** | ^4.7.4 | Gerçek zamanlı WebSocket iletişimi |
| **mqtt** | ^5.3.4 | MQTT protokol istemcisi |
| **sqlite3** | ^5.1.6 | SQLite veritabanı sürücüsü |
| **bcrypt** | ^5.1.1 | Şifre hashleme |
| **express-session** | ^1.18.0 | Oturum yönetimi |
| **multer** | ^1.4.5-lts.1 | Dosya yükleme |
| **fs-extra** | ^11.2.0 | Gelişmiş dosya sistemi işlemleri |

### Geliştirme Bağımlılıkları (devDependencies)
| Paket | Versiyon | Amaç |
|-------|----------|------|
| **react** | ^18.2.0 | UI kütüphanesi |
| **react-dom** | ^18.2.0 | React DOM renderer |
| **react-router-dom** | ^6.8.0 | Client-side routing |
| **react-grid-layout** | ^1.4.4 | Drag & drop grid sistemi |
| **tailwindcss** | ^3.3.6 | CSS framework'ü |
| **webpack** | ^5.89.0 | Module bundler |
| **@babel/core** | ^7.23.0 | JavaScript transpiler |
| **lucide-react** | ^0.294.0 | Icon kütüphanesi |
| **recharts** | ^2.8.0 | Chart kütüphanesi |

## 🔐 Kimlik Doğrulama Sistemi

### Veritabanı Şeması
```sql
-- Kullanıcılar tablosu
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Kullanıcı ayarları tablosu
CREATE TABLE user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(user_id, setting_key)
);

-- Dashboard konfigürasyonu tablosu
CREATE TABLE dashboard_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  config_data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### Güvenlik Özellikleri
- **bcrypt** ile şifre hashleme (10 salt rounds)
- **HTTP-Only** çerezler ile oturum yönetimi
- **Prepared statements** ile SQL injection koruması
- **Kullanıcı izolasyonu** - tam veri ayrımı
- **Session tabanlı** kimlik doğrulama

## 📱 Desteklenen IoT Cihaz Türleri

### Sensör Cihazları (Sadece Okuma)
| Cihaz Türü | Icon | Veri Anahtarları | Birim |
|------------|------|------------------|-------|
| **Sıcaklık Sensörü** | 🌡️ thermometer | Temp, Humidity | °C, % |
| **Kapı Sensörü** | 🚪 door-open | Door, Battery | -, % |
| **Hareket Sensörü** | 🏃 activity | Motion, LastSeen | -, timestamp |
| **Mesafe Sensörü** | 📏 ruler | Distance, Quality | cm, - |
| **Hava Kalitesi** | 💨 wind | CO2, PM25, VOC, AQI | ppm, μg/m³ |
| **Güvenlik Kamerası** | 📹 camera | Status, Motion, Storage | -, boolean, % |
| **Su Kaçağı Sensörü** | 💧 droplets | Status, Battery, LastCheck | -, %, timestamp |

### Kontrol Edilebilir Cihazlar
| Cihaz Türü | Icon | Kontroller | Durumlar |
|------------|------|-----------|----------|
| **Akıllı Röle** | ⚡ zap | ON/OFF toggle | ON (yeşil), OFF (gri) |
| **Akıllı Termostat** | 🏠 gauge | Hedef sıcaklık slider, Mod seçici | Heat, Cool, Auto, Off |
| **Akıllı Kilit** | 🔒 lock | Locked/Unlocked toggle | Locked (yeşil), Unlocked (sarı) |

### Cihaz Konfigürasyon Formatı
```json
{
  "device_type": {
    "topic": "home/room/device",
    "name": "Görünen Ad",
    "icon": "lucide-icon-adı",
    "controllable": true/false,
    "example": { "Key": "Value" },
    "dataKeys": ["Key1", "Key2"],
    "controls": {
      "Key": {
        "type": "toggle|slider|select",
        "states": ["ON", "OFF"],
        "min": 0,
        "max": 100
      }
    },
    "states": {
      "Key": {
        "Value": { "color": "success|warning|danger|gray", "icon": "icon-name" }
      }
    },
    "thresholds": {
      "Key": { "min": 0, "max": 100 }
    }
  }
}
```

## 🌐 MQTT Entegrasyonu

### Topic Yapısı Konvansiyonu
```
home/{room}/{device_type}/{device_id}
```

**Örnekler:**
- `home/oturmaodasi/sicaklik/sensor1`
- `home/mutfak/hareket/detector1`
- `home/yatak_odasi/kapi/ana`

### Mesaj Formatı
```json
{
  "Temp": 23.5,
  "Humidity": 60,
  "Battery": 95,
  "Timestamp": "2024-01-15T10:30:00Z"
}
```

### Kontrol Topic Ayrımı
- **Gelen Veri**: `home/oturmaodasi/role`
- **Giden Kontrol**: `home/oturmaodasi/role_sub`

Bu ayrım geri bildirim döngülerini önler ve istenmeyen cihaz oluşumunu engeller.

## 🎨 UI/UX Özellikleri

### Responsive Tasarım
| Cihaz Türü | Ekran Boyutu | Özellikler |
|------------|-------------|-----------|
| **Desktop** | 1200px+ | Tam drag&drop, tüm widget'lar, yan menü |
| **Tablet** | 768-1199px | Dokunmatik kontroller, katlanabilir menü |
| **Mobile** | <768px | Basitleştirilmiş layout, alt navigasyon |

### Tema Sistemi
- **Otomatik algılama** - sistem tercihine göre
- **Manuel geçiş** - kullanıcı başına kalıcı
- **Dark/Light** modlar
- **Tutarlı renk paleti** - primary, success, warning, danger

### Grid Layout Sistemi
- **Breakpoint'ler**: xxs (400px), xs (600px), sm (768px), md (996px), lg (1200px)
- **Drag & Drop** ile yeniden düzenleme
- **Responsive** otomatik boyutlandırma
- **Kullanıcı başına** layout kaydetme

## 🔧 API Endpoints

### Kimlik Doğrulama API'leri
```http
POST /api/auth/register          # Kullanıcı kaydı
POST /api/auth/login             # Kullanıcı girişi
POST /api/auth/logout            # Kullanıcı çıkışı
GET  /api/auth/me                # Kimlik kontrolü
GET  /api/auth/dashboard-config  # Dashboard config getir
POST /api/auth/dashboard-config  # Dashboard config kaydet
```

### MQTT API'leri (Korumalı)
```http
POST /api/connect                # MQTT broker'a bağlan
POST /api/disconnect             # MQTT bağlantısını kes
POST /api/subscribe              # Topic'e abone ol
POST /api/publish                # Mesaj yayınla
GET  /api/status                 # Bağlantı durumu
```

### Dosya Yükleme API'leri (Korumalı)
```http
POST /api/upload-certificate     # Standart sertifika yükle
POST /api/upload-aws-certificate # AWS IoT sertifika yükle
GET  /api/certificates           # Yüklenmiş sertifikaları listele
```

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- **Node.js** 16+ ve npm
- **MQTT Broker** (Mosquitto, cloud service, veya AWS IoT Core)
- **Modern web tarayıcı** JavaScript desteği ile

### Kurulum Adımları
```bash
# 1. Projeyi klonla
git clone <repository-url>
cd smarthome

# 2. Bağımlılıkları yükle
npm install

# 3. Production build
npm run build

# 4. Sunucuyu başlat
npm start

# 5. Tarayıcıda aç
# http://localhost:3000
```

### Geliştirme Ortamı
```bash
# Terminal 1: Backend (hot reload)
npm run dev

# Terminal 2: Frontend (watch mode)
npm run watch
```

### Environment Variables
```env
SESSION_SECRET=your-super-secret-session-key
PORT=3000
NODE_ENV=production
```

## 📊 Performans ve Optimizasyon

### Frontend Optimizasyonları
- **React 18** concurrent features
- **Lazy loading** bileşenleri
- **Grid layout** virtualization
- **WebSocket** connection pooling
- **Local storage** caching

### Backend Optimizasyonları
- **SQLite** prepared statements
- **Session** memory store
- **MQTT** connection reuse
- **File system** caching
- **Gzip** compression

## 🔒 Güvenlik Önlemleri

### Bağlantı Güvenliği
- **TLS/SSL** şifreleme tüm MQTT bağlantıları için
- **Sertifika tabanlı** kimlik doğrulama AWS IoT Core için
- **Güvenli WebSocket** gerçek zamanlı güncellemeler için
- **Input validation** tüm endpoint'lerde
- **Session tabanlı** kimlik doğrulama

### Veri Koruması
- **Yerel depolama** - bulut veri aktarımı yok
- **Şifreli şifre** depolama bcrypt ile
- **Kullanıcı veri izolasyonu** - tam ayrım
- **Sertifika şifreleme** yüklenen dosyalar için
- **Veritabanı bütünlüğü** foreign key kısıtlamaları ile

## 🧪 Test ve Debug Özellikleri

### MQTT Test Araçları
- **Mesaj test paneli** - özel topic'ler ve JSON payload'lar
- **Gerçek zamanlı mesaj** loglama
- **Renk kodlu** topic'ler ve zaman damgaları
- **Cihaz simülasyonu** - gerçekçi veri kalıpları
- **Otomatik simülasyon** modu
- **Hızlı mesaj** şablonları

### Debug Panelleri
- **Sistem bilgileri** kapsamlı panel
- **Cihaz durumu** monitoring
- **Bağlantı durumu** takibi
- **Performans metrikleri**
- **Error logging** ve raporlama

## 📈 Gelecek Geliştirmeler

### Planlanan Özellikler
- **Grafik ve Analytics** - cihaz verileri için
- **Bildirim sistemi** - push notifications
- **Otomasyon kuralları** - if-then logic
- **Kullanıcı rolleri** - admin/user ayrımı
- **API rate limiting** - güvenlik artırımı
- **PostgreSQL** desteği - büyük ölçek için

### Teknik İyileştirmeler
- **TypeScript** migration
- **Unit testing** coverage
- **Docker** containerization
- **CI/CD** pipeline setup
- **Load balancing** çoklu instance
- **Microservices** architecture

## 🤝 Katkı Sağlama

### Development Workflow
1. **Fork** repository'yi
2. **Feature branch** oluştur: `git checkout -b feature/amazing-feature`
3. **Commit** değişiklikleri: `git commit -m 'Add amazing feature'`
4. **Push** branch'e: `git push origin feature/amazing-feature`
5. **Pull Request** aç

### Kod Standartları
- **ES6+** JavaScript kullan
- **Functional components** React için
- **TailwindCSS** styling için
- **Camel case** naming convention
- **JSDoc** dokümantasyon

## 📞 Destek ve İletişim

### Dokümantasyon
- **README.md** - İngilizce genel bakış
- **PROJE_DOKUMANTASYONU.md** - Türkçe detaylı analiz
- **test-mqtt-topics.md** - MQTT test kılavuzu
- **Inline comments** - kod içi açıklamalar

### Sorun Giderme
1. **Log kontrol** et - browser console ve server logs
2. **MQTT bağlantı** durumunu kontrol et
3. **Database** dosya izinlerini kontrol et
4. **Port** çakışması olmadığından emin ol
5. **SSL sertifika** yapılandırmasını kontrol et

---

**💝 IoT topluluğu için ❤️ ile geliştirilmiştir**

*Bu dokümantasyon projenin mevcut durumunu (v1.0.0) yansıtmaktadır ve geliştirmeler ile birlikte güncellenecektir.* 