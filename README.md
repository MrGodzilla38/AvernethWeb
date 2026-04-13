Bu projenin devamı ve update alan projem: https://github.com/MrGodzilla38/AvernethWebV2.git

# Averneth Web Projesi

Averneth Web, Minecraft sunucusu için geliştirilmiş, modern ve karanlık temalı (Gothic) bir web arayüzü ve yönetim panelidir. Kullanıcıların kayıt olmasını, giriş yapmasını ve profillerini yönetmesini sağlar. Admin paneli üzerinden yetkili kullanıcılar diğer kullanıcıların bilgilerini düzenleyebilir.

## Kullanıcı Rolleri ve Yetkileri

Aşağıdaki tabloda sistemde tanımlı roller ve admin paneline erişim durumları belirtilmiştir:

| Rol | Admin Paneli Erişimi | Açıklama |
| :--- | :---: | :--- |
| **Üye** | ❌ | Standart oyuncu rolü. |
| **Rehber** | ❌ | Oyunculara yardımcı olan başlangıç yetkilisi. |
| **Moderatör** | ❌ | Sohbet ve oyun içi düzeni sağlayan yetkili. |
| **Admin** | ✅ | Sunucu yönetimi ve kullanıcı düzenleme yetkisine sahip. |
| **Baş Yönetici** | ✅ | Üst düzey yönetim yetkilisi. |
| **Kurucu** | ✅ | Sistemin tam yetkili sahibi. |

## Kurulum Adımları

Projeyi yerel ortamınızda çalıştırmak için aşağıdaki adımları izleyin:

### 1. Veritabanı Hazırlığı
- MySQL veritabanınızda `nLogin` tablosunun (veya yapılandırmanıza göre farklı bir tablonun) mevcut olduğundan emin olun.
- Tabloda `rank` (VARCHAR) ve `balance` (DECIMAL/DOUBLE) sütunlarının bulunduğundan emin olun.

### 2. Sunucu Yapılandırması
- `server` klasörüne gidin.
- `.env.example` dosyasını `.env` olarak kopyalayın ve veritabanı bilgilerinizi, JWT sırrınızı doldurun.
- Bağımlılıkları yükleyin:
  ```bash
  npm install
  ```
- Sunucuyu başlatın:
  ```bash
  node index.js
  ```

### 3. Ön Yüz (Frontend)
- Web dosyalarını bir HTTP sunucusu (Live Server, Apache, Nginx vb.) üzerinden açın.
- `admin.html` dosyasındaki `data-api-base` özniteliğinin API adresinizle uyumlu olduğundan emin olun (varsayılan: `http://127.0.0.1:3847`).

## Teknolojiler
- **Backend:** Node.js, Express, MySQL, JWT, bcrypt.
- **Frontend:** HTML5, CSS3 (Modern Flexbox/Grid), Vanilla JavaScript.
