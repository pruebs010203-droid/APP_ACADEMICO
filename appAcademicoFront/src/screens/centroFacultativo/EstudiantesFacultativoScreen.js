import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import CentroFacultativoBottomNav from '../../components/CentroFacultativoBottomNav';

const PRIMARY = '#0369a1';

export default function EstudiantesFacultativoScreen({ navigation }) {
  const { usuario } = useAuth();
  const facultadId = usuario?.facultad_id || usuario?.carrera?.facultad?.id;

  const [estudiantes, setEstudiantes] = useState([]);
  const [estudiantesFiltrados, setEstudiantesFiltrados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const loadEstudiantes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/usuarios');

      const usuarios = response.data?.data ?? response.data ?? [];
      const usuariosArr = Array.isArray(usuarios) ? usuarios : [];

      // Filtrar estudiantes de la facultad
      const estudiantesFiltrados = usuariosArr.filter((u) => {
        const roles = u.roles_usuario ?? u.rolesUsuario ?? u.roles ?? [];
        const esEstudiante = roles.some((r) => {
          const n = typeof r === 'string' ? r : (r?.rol ?? r?.name ?? '');
          return n === 'estudiante';
        });
        
        const mismaFacultad = facultadId
          ? String(u.facultad_id || u.carrera?.facultad?.id) === String(facultadId)
          : true;
        
        return esEstudiante && mismaFacultad;
      });

      setEstudiantes(estudiantesFiltrados);
      setEstudiantesFiltrados(estudiantesFiltrados);
    } catch (e) {
      console.error('Error cargando estudiantes:', e);
      Alert.alert('Error', 'No se pudieron cargar los estudiantes');
    } finally {
      setLoading(false);
    }
  }, [facultadId]);

  useFocusEffect(useCallback(() => { loadEstudiantes(); }, [loadEstudiantes]));

  // Filtrar por búsqueda
  React.useEffect(() => {
    if (!busqueda.trim()) {
      setEstudiantesFiltrados(estudiantes);
    } else {
      const filtro = busqueda.toLowerCase();
      const filtrados = estudiantes.filter((est) => {
        const nombre = est.nombre?.toLowerCase() || '';
        const email = est.email?.toLowerCase() || '';
        const ru = est.registro_universitario?.toLowerCase() || '';
        return (
          nombre.includes(filtro) ||
          email.includes(filtro) ||
          ru.includes(filtro)
        );
      });
      setEstudiantesFiltrados(filtrados);
    }
  }, [busqueda, estudiantes]);

  const tieneRolCentro = (estudiante) => {
    const roles = estudiante.roles_usuario ?? estudiante.rolesUsuario ?? estudiante.roles ?? [];
    return roles.some((r) => {
      const n = typeof r === 'string' ? r : (r?.rol ?? r?.name ?? '');
      return n === 'centro_estudiantes' || n === 'centro_facultativo';
    });
  };

  const getRolCentro = (estudiante) => {
    const roles = estudiante.roles_usuario ?? estudiante.rolesUsuario ?? estudiante.roles ?? [];
    const rolCentro = roles.find((r) => {
      const n = typeof r === 'string' ? r : (r?.rol ?? r?.name ?? '');
      return n === 'centro_estudiantes' || n === 'centro_facultativo';
    });
    return typeof rolCentro === 'string' ? rolCentro : (rolCentro?.rol ?? '');
  };

  const toggleRolCentro = async (estudiante) => {
    try {
      setUpdatingId(estudiante.id);
      const roles = estudiante.roles_usuario ?? estudiante.rolesUsuario ?? estudiante.roles ?? [];
      
      // Obtener roles actuales como array de strings
      const rolesActuales = roles.map((r) => typeof r === 'string' ? r : (r?.rol ?? r?.name ?? ''));
      
      // Determinar si agregar o quitar el rol
      const rolCentroActual = getRolCentro(estudiante);
      let nuevosRoles;
      
      if (rolCentroActual) {
        // Quitar rol de centro
        nuevosRoles = rolesActuales.filter((r) => r !== 'centro_estudiantes' && r !== 'centro_facultativo');
      } else {
        // Por defecto agregar centro_estudiantes (puede cambiar a centro_facultativo si se desea)
        nuevosRoles = [...rolesActuales, 'centro_estudiantes'];
      }

      const response = await api.put(`/usuarios/${estudiante.id}`, {
        nombre: estudiante.nombre,
        email: estudiante.email,
        roles: nuevosRoles,
        carrera_id: estudiante.carrera_id,
        facultad_id: estudiante.facultad_id,
      });

      if (response.data?.success) {
        Alert.alert(
          'Éxito',
          rolCentroActual 
            ? 'Rol de centro estudiantil removido' 
            : 'Rol de centro estudiantil asignado'
        );
        loadEstudiantes();
      } else {
        throw new Error('Error en la respuesta');
      }
    } catch (e) {
      console.error('Error actualizando rol:', e);
      Alert.alert(
        'Error',
        e?.response?.data?.message || 'No se pudo actualizar el rol'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Gestión de Estudiantes</Text>
          <Text style={s.headerSub}>
            Asigna roles de centro estudiantil a estudiantes de tu facultad
          </Text>
        </View>

        {/* Buscador */}
        <View style={s.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#64748b" style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por nombre, email o RU..."
            placeholderTextColor="#94a3b8"
            value={busqueda}
            onChangeText={setBusqueda}
          />
          {busqueda.length > 0 && (
            <Pressable onPress={() => setBusqueda('')}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </Pressable>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={PRIMARY} style={{ marginVertical: 40 }} />
        ) : estudiantesFiltrados.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={48} color="#94a3b8" />
            <Text style={s.emptyText}>
              {busqueda ? 'No se encontraron resultados' : 'No hay estudiantes en tu facultad'}
            </Text>
          </View>
        ) : (
          <View style={s.list}>
            {estudiantesFiltrados.map((est) => {
              const esCentro = tieneRolCentro(est);
              const rolCentro = getRolCentro(est);
              const isUpdating = updatingId === est.id;

              return (
                <View key={est.id} style={s.card}>
                  <View style={s.cardLeft}>
                    <View style={[s.avatar, { backgroundColor: esCentro ? '#bae6fd' : '#e2e8f0' }]}>
                      <Text style={[s.avatarText, { color: esCentro ? '#0369a1' : '#64748b' }]}>
                        {est.nombre.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={s.cardInfo}>
                      <Text style={s.name}>{est.nombre}</Text>
                      <Text style={s.email}>{est.email}</Text>
                      <Text style={s.carrera}>{est.carrera?.nombre || 'Sin carrera'}</Text>
                      {esCentro && (
                        <View style={s.badge}>
                          <Ionicons name="ribbon-outline" size={12} color="#0369a1" />
                          <Text style={s.badgeText}>
                            {rolCentro === 'centro_facultativo' ? 'Centro Facultativo' : 'Centro Estudiantil'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Pressable
                    style={[s.toggle, esCentro ? s.toggleActive : s.toggleInactive]}
                    onPress={() => toggleRolCentro(est)}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons 
                        name={esCentro ? 'checkmark' : 'add'} 
                        size={20} 
                        color="#fff" 
                      />
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>
      <CentroFacultativoBottomNav navigation={navigation} active="EstudiantesFacultativo" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { padding: 20, paddingBottom: 40 },
  
  header: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  headerSub: {
    fontSize: 13,
    color: '#bae6fd',
    fontWeight: '500',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 12,
    fontWeight: '500',
  },

  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  cardInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  email: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  carrera: { fontSize: 11, color: '#94a3b8', marginBottom: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#0369a1' },
  toggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: '#0369a1' },
  toggleInactive: { backgroundColor: '#cbd5e1' },
});
