# import image node versi 18 alpine
# 1. Menggunakan image dasar Node.js 18 versi Alpine (ringan)
FROM node:18-alpine

# 2. Menentukan direktori kerja di dalam container
WORKDIR /usr/src/app

# 3. Menyalin file package.json dan package-lock.json untuk instalasi dependensi
# Ini diletakkan sebelum copy seluruh file agar proses build lebih cepat (caching)
COPY package*.json ./

# 4. Menginstal dependensi aplikasi sesuai yang ada di package.json
# Termasuk express, mysql2, ejs, body-parser, dan dotenv
RUN npm install

# 5. Menyalin seluruh kode sumber aplikasi ke dalam container
COPY . .

# 6. Memberitahukan bahwa container akan berjalan pada port 3000
# Ini sesuai dengan konfigurasi internal APP_PORT di docker-compose
EXPOSE 3000

# 7. Perintah untuk menjalankan aplikasi
CMD ["npm", "start"]