-- TODO: Tulis query SQL kalian di sini (CREATE TABLE & INSERT) untuk inisialisasi database otomatis
CREATE DATABASE IF NOT EXISTS db_konseling;
USE db_konseling;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'psikolog', 'mahasiswa') NOT NULL
);

CREATE TABLE psikolog_status (
    id INT PRIMARY KEY,
    nama_psikolog VARCHAR(100),
    jadwal_tugas VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reservasi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mahasiswa_id INT,
    nama_mhs VARCHAR(100),
    nim VARCHAR(20),
    tanggal DATE,
    waktu TIME,
    psikolog_id INT,
    status ENUM('menunggu', 'dikonfirmasi', 'ditolak') DEFAULT 'menunggu',
    pesan_tolak TEXT NULL,
    FOREIGN KEY (mahasiswa_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (psikolog_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Akun Default Admin
INSERT INTO users (username, password, role) VALUES ('kelompok6', '12345', 'admin');