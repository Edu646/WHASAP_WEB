CREATE DATABASE clinica;
SET NAMES UTF8;
CREATE DATABASE IF NOT EXISTS clinica;
USE clinica;

DROP TABLE IF EXISTS pacientes;
CREATE TABLE IF NOT EXISTS pacientes( 
id              int auto_increment not null,
nombre          varchar(64) not null,
apellidos       varchar(64) not null,
correo          varchar(255) not null,
password        varchar(255) not null,
CONSTRAINT pk_pacientes PRIMARY KEY(id),
CONSTRAINT uq_correo UNIQUE(correo)  
)ENGINE=InnoDb DEFAULT CHARSET=utf8 COLLATE=utf8_bin;

DROP TABLE IF EXISTS medicos;
CREATE TABLE IF NOT EXISTS medicos( 
id              int auto_increment not null,
nombre          varchar(64) not null,
apellidos       varchar(64) not null,
telefono        varchar(9) not null,
especialidad        varchar(255) not null,
CONSTRAINT pk_medicos PRIMARY KEY(id)
)ENGINE=InnoDb DEFAULT CHARSET=utf8 COLLATE=utf8_bin;


DROP TABLE IF EXISTS citas;
CREATE TABLE IF NOT EXISTS citas( 
id              int auto_increment not null,
paciente_id     int not null,
medico_id       int not null,
fecha           date not null,
hora            time not null,
CONSTRAINT pk_citas PRIMARY KEY(id),
CONSTRAINT fk_cita_paciente FOREIGN KEY(paciente_id) REFERENCES pacientes(id),
CONSTRAINT fk_cita_medico FOREIGN KEY(medico_id) REFERENCES medicos(id)
)ENGINE=InnoDb DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
