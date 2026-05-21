<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Carrera;
use App\Models\RolUsuario;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Throwable;

class UsuarioController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Usuario::with(['rolesUsuario', 'carrera', 'facultad']);
            $usuarioActual = $request->user();
            $habilidades = $usuarioActual?->currentAccessToken()?->abilities ?? [];
            $rolActivo = collect($habilidades)->first(fn (string $habilidad) => $habilidad !== '*');
            
            // Filtrar por carrera si se proporciona
            if ($request->has('carrera_id') && $request->carrera_id && is_numeric($request->carrera_id)) {
                $query->where('carrera_id', (int) $request->carrera_id);
            } elseif ($rolActivo === 'director') {
                $contextoCarrera = $this->getCarreraContext($usuarioActual);
                if ($contextoCarrera['carrera_id']) {
                    $query->where('carrera_id', $contextoCarrera['carrera_id']);
                }
            }
            
            $usuarios = $query->get();

            return response()->json([
                'success' => true,
                'data' => $usuarios,
            ], 200);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error del servidor.',
            ], 500);
        }
    }

    public function store(Request $request): JsonResponse
    {
        try {
            // Verificar si el usuario actual es director (no decano)
            $usuarioActual = $request->user();
            $habilidades = $usuarioActual?->currentAccessToken()?->abilities ?? [];
            $rolActivo = collect($habilidades)->first(fn (string $habilidad) => $habilidad !== '*');
            $esDecano = $rolActivo === 'decano';
            $esDirector = $rolActivo === 'director';
            $esCentroEstudiantes = $rolActivo === 'centro_estudiantes';
            $esCentroFacultativo = $rolActivo === 'centro_facultativo';
            
            // Si es director, solo puede crear docentes/estudiantes en su carrera
            if ($esDirector) {
                $contextoCarrera = $this->getCarreraContext($usuarioActual);
                $request->merge([
                    'carrera_id' => $contextoCarrera['carrera_id'],
                    'facultad_id' => $contextoCarrera['facultad_id'],
                ]);
            }
            
            // Si es centro_estudiantes, solo puede asignar rol centro_estudiantes en su carrera
            if ($esCentroEstudiantes) {
                $contextoCarrera = $this->getCarreraContext($usuarioActual);
                if (!$contextoCarrera['carrera_id']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No tienes una carrera asignada.',
                    ], 403);
                }
                $request->merge([
                    'carrera_id' => $contextoCarrera['carrera_id'],
                    'facultad_id' => $contextoCarrera['facultad_id'],
                ]);
            }
            
            // Si es centro_facultativo, solo puede asignar roles de centro en su facultad
            if ($esCentroFacultativo) {
                $contextoFacultad = $this->getFacultadContext($usuarioActual);
                if (!$contextoFacultad['facultad_id']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No tienes una facultad asignada.',
                    ], 403);
                }
                $request->merge([
                    'facultad_id' => $contextoFacultad['facultad_id'],
                ]);
            }
            
            $validator = Validator::make($request->all(), [
                'nombre' => ['required', 'string', 'max:255'],
                'email' => ['required', 'email', 'max:255', 'unique:usuarios,email'],
                'password' => ['required', 'string', 'min:6'],
                'rol' => ['nullable', Rule::in(
                    $esDirector
                        ? ['docente', 'estudiante', 'centro_estudiantes']
                        : ($esCentroEstudiantes
                            ? ['centro_estudiantes']
                            : ($esCentroFacultativo
                                ? ['centro_estudiantes', 'centro_facultativo']
                                : ['decano', 'director', 'centro_facultativo', 'centro_estudiantes', 'docente', 'estudiante']
                            )
                        )
                )],
                'roles' => ['nullable', 'array'],
                'roles.*' => [Rule::in(
                    $esDirector
                        ? ['docente', 'estudiante', 'centro_estudiantes']
                        : ($esCentroEstudiantes
                            ? ['centro_estudiantes']
                            : ($esCentroFacultativo
                                ? ['centro_estudiantes', 'centro_facultativo']
                                : ['decano', 'director', 'centro_facultativo', 'centro_estudiantes', 'docente', 'estudiante']
                            )
                        )
                )],
                'registro_universitario' => ['nullable', 'string', 'max:20', 'unique:usuarios,registro_universitario'],
                'carrera_id' => ['nullable', 'integer', 'exists:carreras,id'],
                'facultad_id' => ['nullable', 'integer', 'exists:facultades,id'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Error de validacion.',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $data = $validator->validated();

            // Normalizar roles: acepta 'rol' (string) o 'roles' (array)
            $rolesArray = [];
            if (!empty($data['roles'])) {
                $rolesArray = array_unique($data['roles']);
            } elseif (!empty($data['rol'])) {
                $rolesArray = [$data['rol']];
            }

            if (empty($rolesArray)) {
                return response()->json(['message' => 'Debes asignar al menos un rol.'], 422);
            }

            // RU requerido si es estudiante
            $esEstudiante = in_array('estudiante', $rolesArray);
            if ($esEstudiante && empty($data['registro_universitario'])) {
                return response()->json([
                    'message' => 'Error de validacion.',
                    'errors' => ['registro_universitario' => ['El RU es obligatorio para estudiantes.']],
                ], 422);
            }

            // Docente es incompatible con roles de estudiante/centro
            // Pero sí puede combinarse con director o decano
            $rolesIncompatiblesConDocente = ['estudiante', 'centro_estudiantes', 'centro_facultativo'];
            if (in_array('docente', $rolesArray)) {
                $conflictos = array_intersect($rolesArray, $rolesIncompatiblesConDocente);
                if (!empty($conflictos)) {
                    return response()->json([
                        'message' => 'Error de validacion.',
                        'errors' => ['roles' => ['El rol docente no puede combinarse con roles de estudiante o centro.']],
                    ], 422);
                }
            }
            
            // Si es director, verificar que no intente asignar a otra carrera
            if ($esDirector) {
                $contextoCarrera = $this->getCarreraContext($usuarioActual);
                if (! $contextoCarrera['carrera_id'] || (int) $data['carrera_id'] !== (int) $contextoCarrera['carrera_id']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No puedes crear usuarios en otra carrera.',
                    ], 403);
                }
            }

            $usuario = DB::transaction(function () use ($data, $rolesArray) {
                $usuario = Usuario::create([
                    'nombre'                  => $data['nombre'],
                    'email'                   => $data['email'],
                    'registro_universitario'  => $data['registro_universitario'] ?? null,
                    'password'                => Hash::make($data['password']),
                    'esta_verificado'         => true, // Admin crea usuarios ya verificados
                    'carrera_id'              => $data['carrera_id'] ?? null,
                    'facultad_id'             => $data['facultad_id'] ?? null,
                ]);

                foreach ($rolesArray as $rol) {
                    RolUsuario::create([
                        'usuario_id' => $usuario->id,
                        'rol'        => $rol,
                        'carrera_id' => $data['carrera_id'] ?? null,
                        'facultad_id'=> $data['facultad_id'] ?? null,
                    ]);
                }

                return $usuario->load(['rolesUsuario', 'carrera', 'facultad']);
            });

            return response()->json([
                'success' => true,
                'message' => 'Usuario creado correctamente.',
                'data' => $usuario,
            ], 201);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error del servidor.',
            ], 500);
        }
    }

    public function show(int $id): JsonResponse
    {
        try {
            $usuario = Usuario::with(['rolesUsuario', 'carrera', 'facultad'])->find($id);

            if (! $usuario) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no encontrado.',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $usuario,
            ], 200);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error del servidor.',
            ], 500);
        }
    }

    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $usuario = Usuario::find($id);

            if (! $usuario) {
                return response()->json([
                    'message' => 'Usuario no encontrado.',
                ], 404);
            }

            // Verificar permisos del usuario actual
            $usuarioActual = $request->user();
            $habilidades = $usuarioActual?->currentAccessToken()?->abilities ?? [];
            $rolActivo = collect($habilidades)->first(fn (string $habilidad) => $habilidad !== '*');
            $esDecano = $rolActivo === 'decano';
            $esDirector = $rolActivo === 'director';
            $esCentroEstudiantes = $rolActivo === 'centro_estudiantes';
            $esCentroFacultativo = $rolActivo === 'centro_facultativo';

            // Si es centro_estudiantes, solo puede asignar rol centro_estudiantes en su carrera
            if ($esCentroEstudiantes) {
                $contextoCarrera = $this->getCarreraContext($usuarioActual);
                if (!$contextoCarrera['carrera_id']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No tienes una carrera asignada.',
                    ], 403);
                }
                // Verificar que el usuario a actualizar esté en la misma carrera
                if ($usuario->carrera_id && (int) $usuario->carrera_id !== (int) $contextoCarrera['carrera_id']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Solo puedes modificar usuarios de tu carrera.',
                    ], 403);
                }
                $request->merge([
                    'carrera_id' => $contextoCarrera['carrera_id'],
                    'facultad_id' => $contextoCarrera['facultad_id'],
                ]);
            }

            // Si es centro_facultativo, solo puede asignar roles de centro en su facultad
            if ($esCentroFacultativo) {
                $contextoFacultad = $this->getFacultadContext($usuarioActual);
                if (!$contextoFacultad['facultad_id']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No tienes una facultad asignada.',
                    ], 403);
                }
                // Verificar que el usuario a actualizar esté en la misma facultad
                if ($usuario->facultad_id && (int) $usuario->facultad_id !== (int) $contextoFacultad['facultad_id']) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Solo puedes modificar usuarios de tu facultad.',
                    ], 403);
                }
                $request->merge([
                    'facultad_id' => $contextoFacultad['facultad_id'],
                ]);
            }

            $validator = Validator::make($request->all(), [
                'nombre'                 => ['required', 'string', 'max:255'],
                'email'                  => ['required', 'email', 'max:255', Rule::unique('usuarios', 'email')->ignore($usuario->id)],
                'password'               => ['nullable', 'string', 'min:6'],
                'rol'                    => ['nullable', Rule::in(
                    $esDirector
                        ? ['docente', 'estudiante', 'centro_estudiantes']
                        : ($esCentroEstudiantes
                            ? ['centro_estudiantes']
                            : ($esCentroFacultativo
                                ? ['centro_estudiantes', 'centro_facultativo']
                                : ['decano', 'director', 'centro_facultativo', 'centro_estudiantes', 'docente', 'estudiante']
                            )
                        )
                )],
                'roles'                  => ['nullable', 'array'],
                'roles.*'                => [Rule::in(
                    $esDirector
                        ? ['docente', 'estudiante', 'centro_estudiantes']
                        : ($esCentroEstudiantes
                            ? ['centro_estudiantes', 'estudiante']
                            : ($esCentroFacultativo
                                ? ['centro_estudiantes', 'centro_facultativo', 'estudiante']
                                : ['decano', 'director', 'centro_facultativo', 'centro_estudiantes', 'docente', 'estudiante']
                            )
                        )
                )],
                'registro_universitario' => ['nullable', 'string', 'max:20', Rule::unique('usuarios', 'registro_universitario')->ignore($usuario->id)],
                'esta_verificado'        => ['nullable', 'boolean'],
                'carrera_id'             => ['nullable', 'integer', 'exists:carreras,id'],
                'facultad_id'            => ['nullable', 'integer', 'exists:facultades,id'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Error de validacion.',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $data = $validator->validated();

            // Validar combinaciones de roles incompatibles
            $rolesParaValidar = [];
            if (!empty($data['roles'])) {
                $rolesParaValidar = array_unique($data['roles']);
            } elseif (!empty($data['rol'])) {
                $rolesParaValidar = [$data['rol']];
            }

            if (!empty($rolesParaValidar)) {
                $rolesIncompatiblesConDocente = ['estudiante', 'centro_estudiantes', 'centro_facultativo'];
                if (in_array('docente', $rolesParaValidar)) {
                    $conflictos = array_intersect($rolesParaValidar, $rolesIncompatiblesConDocente);
                    if (!empty($conflictos)) {
                        return response()->json([
                            'message' => 'Error de validacion.',
                            'errors' => ['roles' => ['El rol docente no puede combinarse con roles de estudiante o centro.']],
                        ], 422);
                    }
                }
            }

            $usuario = DB::transaction(function () use ($data, $usuario) {
                $payload = [
                    'nombre'                 => $data['nombre'],
                    'email'                  => $data['email'],
                    'registro_universitario' => $data['registro_universitario'] ?? $usuario->registro_universitario,
                    'esta_verificado'        => $data['esta_verificado'] ?? $usuario->esta_verificado,
                    'carrera_id'             => $data['carrera_id'] ?? null,
                    'facultad_id'            => $data['facultad_id'] ?? null,
                ];

                if (!empty($data['password'])) {
                    $payload['password'] = Hash::make($data['password']);
                }

                $usuario->update($payload);

                // Normalizar roles
                $rolesArray = [];
                if (!empty($data['roles'])) {
                    $rolesArray = array_unique($data['roles']);
                } elseif (!empty($data['rol'])) {
                    $rolesArray = [$data['rol']];
                }

                if (!empty($rolesArray)) {
                    // Reemplazar todos los roles existentes
                    $usuario->rolesUsuario()->delete();
                    foreach ($rolesArray as $rol) {
                        RolUsuario::create([
                            'usuario_id'  => $usuario->id,
                            'rol'         => $rol,
                            'carrera_id'  => $data['carrera_id'] ?? null,
                            'facultad_id' => $data['facultad_id'] ?? null,
                        ]);
                    }
                }

                return $usuario->load(['rolesUsuario', 'carrera', 'facultad']);
            });

            return response()->json([
                'success' => true,
                'message' => 'Usuario actualizado correctamente.',
                'data' => $usuario,
            ], 200);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error del servidor.',
            ], 500);
        }
    }

    public function destroy(int $id): JsonResponse
    {
        try {
            $usuario = Usuario::find($id);

            if (! $usuario) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no encontrado.',
                ], 404);
            }

            $usuario->delete();

            return response()->json([
                'success' => true,
                'message' => 'Usuario eliminado correctamente.',
            ], 200);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error del servidor.',
            ], 500);
        }
    }

    public function asignarDirector(Request $request, int $id): JsonResponse
    {
        try {
            $usuario = Usuario::find($id);

            if (! $usuario) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no encontrado.',
                ], 404);
            }

            $validator = Validator::make($request->all(), [
                'carrera_id' => ['required', 'integer', 'exists:carreras,id'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validacion.',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $data = $validator->validated();
            $carrera = Carrera::find($data['carrera_id']);

            if (! $carrera) {
                return response()->json([
                    'success' => false,
                    'message' => 'Carrera no encontrada.',
                ], 404);
            }

            RolUsuario::create([
                'usuario_id' => $usuario->id,
                'rol' => 'director',
                'carrera_id' => $carrera->id,
                'facultad_id' => $carrera->facultad_id,
            ]);

            $usuario->update([
                'carrera_id' => $carrera->id,
                'facultad_id' => $carrera->facultad_id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Director asignado correctamente.',
                'data' => $usuario->load(['rolesUsuario', 'carrera', 'facultad']),
            ], 200);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error del servidor.',
            ], 500);
        }
    }

    private function getCarreraContext(?Usuario $usuario): array
    {
        if (! $usuario) {
            return ['carrera_id' => null, 'facultad_id' => null];
        }

        $usuario->loadMissing('rolesUsuario');
        $rolConCarrera = $usuario->rolesUsuario
            ->first(fn ($rolUsuario) => $rolUsuario->rol === 'director' && $rolUsuario->carrera_id)
            ?? $usuario->rolesUsuario->first(fn ($rolUsuario) => $rolUsuario->carrera_id);

        return [
            'carrera_id' => $usuario->carrera_id ?? $rolConCarrera?->carrera_id,
            'facultad_id' => $usuario->facultad_id ?? $rolConCarrera?->facultad_id,
        ];
    }

    private function getFacultadContext(?Usuario $usuario): array
    {
        if (! $usuario) {
            return ['facultad_id' => null];
        }

        $usuario->loadMissing('rolesUsuario');
        $rolConFacultad = $usuario->rolesUsuario
            ->first(fn ($rolUsuario) => $rolUsuario->rol === 'centro_facultativo' && $rolUsuario->facultad_id)
            ?? $usuario->rolesUsuario->first(fn ($rolUsuario) => $rolUsuario->facultad_id);

        return [
            'facultad_id' => $usuario->facultad_id ?? $rolConFacultad?->facultad_id,
        ];
    }
}
