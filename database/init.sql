-- TODO: Tulis query SQL kalian di sini (CREATE TABLE & INSERT) untuk inisialisasi database otomatis
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('mahasiswa', 'psikolog', 'admin') NOT NULL
);

CREATE TABLE IF NOT EXISTS psikolog_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    psikolog_id INT NULL,
    nama_psikolog VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    jadwal_tugas VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS reservasi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mahasiswa_id INT,
    nama_mhs VARCHAR(100),
    nim VARCHAR(20),
    tanggal DATE,
    waktu TIME,
    psikolog_id INT,
    status ENUM('menunggu', 'dikonfirmasi', 'ditolak') DEFAULT 'menunggu'
);

-- Data Awal
INSERT INTO users (username, password, role) VALUES 
('admin', '12345', 'admin'),
('psikolog1', '12345', 'psikolog'),
('mhs1', '12345', 'mahasiswa');

INSERT INTO psikolog_status (nama_psikolog, jadwal_tugas, is_active) VALUES 
('Dr. Budi Sp.KJ', 'Senin - Rabu (09:00 - 12:00)', 1),
('Siska, M.Psi', 'Kamis - Jumat (13:00 - 15:00)', 1);