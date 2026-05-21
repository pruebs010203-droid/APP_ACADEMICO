<?php

namespace Database\Seeders;

use App\Models\RolUsuario;
use App\Models\Usuario;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SuperAdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Use DB directly to bypass the 'hashed' cast on the model,
        // ensuring bcrypt is used consistently with Hash::check in AuthController.
        $existing = DB::table('usuarios')->where('email', 'admin@academico.com')->first();

        if ($existing) {
            DB::table('usuarios')->where('email', 'admin@academico.com')->update([
                'nombre'          => 'Super Admin',
                'password'        => bcrypt('admin123'),
                'esta_verificado' => true,
                'facultad_id'     => null,
                'carrera_id'      => null,
                'matricula_pdf'   => null,
                'deleted_at'      => null,
                'updated_at'      => now(),
            ]);
            $usuarioId = $existing->id;
        } else {
            $usuarioId = DB::table('usuarios')->insertGetId([
                'nombre'          => 'Super Admin',
                'email'           => 'admin@academico.com',
                'password'        => bcrypt('admin123'),
                'esta_verificado' => true,
                'facultad_id'     => null,
                'carrera_id'      => null,
                'matricula_pdf'   => null,
                'deleted_at'      => null,
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);
        }

        RolUsuario::updateOrCreate(
            [
                'usuario_id' => $usuarioId,
                'rol' => 'decano',
            ],
            [
                'carrera_id' => null,
                'facultad_id' => null,
            ]
        );

    }
}
