# Admin Config Database Migration

Bu güncelleme ile tüm admin konfigürasyonları artık SQLite database'inde saklanmaktadır. Önceki JSON dosyası tabanlı sistem yerine, tüm ayarlar `admin_settings` tablosunda güvenli bir şekilde tutulmaktadır.

## 🚀 Yeni Özellikler

### ✅ **Database Tabanlı Konfigürasyon**
- Tüm admin ayarları SQLite database'inde saklanır
- Otomatik migration sistemi
- Güvenli veri saklama
- Gerçek zamanlı güncelleme

### ✅ **Gelişmiş Admin Ayarları**
- **Default Admin Settings**: Varsayılan admin kullanıcı bilgileri
- **Admin Settings**: Sistem yönetimi ayarları
- **System Settings**: Genel sistem konfigürasyonu

## 📊 Database Yapısı

### `admin_settings` Tablosu
```sql
CREATE TABLE admin_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type TEXT DEFAULT 'string',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Kaydedilen Ayarlar

#### Default Admin Settings
- `default_admin_username` - Varsayılan admin kullanıcı adı
- `default_admin_email` - Varsayılan admin email
- `default_admin_password` - Varsayılan admin şifresi

#### Admin Settings
- `allow_multiple_admins` - Çoklu admin kullanıcılarına izin ver
- `force_password_change` - İlk girişte şifre değiştirmeyi zorunlu kıl
- `session_timeout` - Oturum zaman aşımı (milisaniye)
- `max_login_attempts` - Maksimum giriş denemesi

#### System Settings
- `max_users` - Maksimum kullanıcı sayısı
- `system_name` - Sistem görünen adı
- `enable_registration` - Yeni kullanıcı kaydına izin ver
- `default_user_role` - Yeni kullanıcılar için varsayılan rol

## 🔄 Migration Süreci

### Otomatik Migration
Server başlatıldığında otomatik olarak çalışır:
1. Mevcut `admin.json` dosyası kontrol edilir
2. Varsa, veriler database'e aktarılır
3. Orijinal dosya yedeklenir (`admin.json.backup`)
4. Sistem database'den okumaya geçer

### Manuel Migration
Eğer otomatik migration çalışmazsa:

```bash
# Migration script'ini çalıştır
node src/config/migrate-admin-config.js

# Test et
node src/config/test-admin-config.js
```

## 🧪 Test Etme

### Admin Config Test
```bash
node src/config/test-admin-config.js
```

Bu script şunları test eder:
- ✅ Config yükleme
- ✅ Config kaydetme
- ✅ Tekrar yükleme
- ✅ Bireysel ayarlar
- ✅ Tüm ayarları listeleme

## 🔧 API Endpoints

### Admin Config Endpoints
- `GET /api/admin/config` - Admin config'i getir
- `POST /api/admin/config` - Admin config'i güncelle
- `POST /api/admin/reset-password` - Admin şifresini sıfırla

### Admin Settings Endpoints
- `GET /api/admin/settings` - Tüm admin ayarlarını getir
- `POST /api/admin/settings` - Admin ayarı ekle/güncelle

## 📝 Kullanım Örnekleri

### Frontend'den Config Güncelleme
```javascript
// Admin config'i güncelle
const updateConfig = async (newConfig) => {
  const response = await fetch('/api/admin/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ config: newConfig })
  });
  
  if (response.ok) {
    console.log('Config güncellendi!');
  }
};
```

### Backend'den Config Okuma
```javascript
// Database'den config yükle
const config = await database.loadAdminConfig();
console.log('System Name:', config.systemSettings.systemName);
```

## 🔒 Güvenlik

### Şifre Güvenliği
- Admin şifreleri database'de güvenli şekilde saklanır
- API yanıtlarında şifre gizlenir (`••••••••`)
- Şifre değişikliği için özel endpoint

### Veri Doğrulama
- Tüm config verileri doğrulanır
- Zorunlu alanlar kontrol edilir
- Veri tipleri kontrol edilir

## 🚨 Önemli Notlar

1. **Yedekleme**: Migration sırasında orijinal `admin.json` dosyası yedeklenir
2. **Geri Alma**: Gerekirse yedek dosyadan geri yükleyebilirsiniz
3. **Test**: Production'a geçmeden önce test ortamında deneyin
4. **Monitoring**: Database bağlantısını ve ayarları düzenli kontrol edin

## 🔍 Sorun Giderme

### Migration Başarısız Olursa
1. Database dosyasının yazma izinlerini kontrol edin
2. `admin.json` dosyasının geçerli JSON formatında olduğunu kontrol edin
3. Migration loglarını kontrol edin

### Config Yüklenemezse
1. Database bağlantısını kontrol edin
2. `admin_settings` tablosunun var olduğunu kontrol edin
3. Varsayılan config değerleri kullanılır

### Test Script'i Çalışmazsa
1. Database dosyasının varlığını kontrol edin
2. Node.js modüllerinin yüklü olduğunu kontrol edin
3. Hata mesajlarını kontrol edin

## 📈 Performans

### Avantajlar
- ✅ Daha hızlı veri erişimi
- ✅ ACID uyumluluğu
- ✅ Eşzamanlı erişim desteği
- ✅ Veri bütünlüğü

### Optimizasyonlar
- İndeksler otomatik oluşturulur
- Sadece değişen veriler güncellenir
- Lazy loading kullanılır

---

**Not**: Bu migration geri alınamaz. Production ortamında kullanmadan önce mutlaka test edin! 