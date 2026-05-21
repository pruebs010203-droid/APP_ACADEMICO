import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList,
  Pressable, SafeAreaView, Text, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { remove } from '../../services/materiaService';
import getErrorMessage from '../../utils/apiError';
import BottomNav from '../../components/BottomNav';

export default function MateriasScreen({ navigation }) {
  const { usuario } = useAuth();
  const carreraId = usuario?.carrera_id;

  const [carrera, setCarrera] = useState(usuario?.carrera ?? null);
  const [materiasPorSeccion, setMateriasPorSeccion] = useState({});
  const [loading, setLoading] = useState(true);

  // Cargar carrera desde API si no viene en el contexto
  useEffect(() => {
  const cargarCarrera = async () => {
    if (carreraId && (!carrera || !carrera.secciones)) {
      try {
        // Usar el endpoint de stats que ya tiene permiso
        const res = await api.get('/dashboard/director-stats');
        if (res.data?.success && res.data?.data?.mi_carrera) {
          const miCarrera = res.data.data.mi_carrera;
          setCarrera(miCarrera);
          console.log('Carrera desde stats:', JSON.stringify(miCarrera));
        }
      } catch (e) {
        console.log('Error cargando carrera:', e);
      }
    }
  };
  cargarCarrera();
}, [carreraId]);

  const tipoCarrera = carrera?.tipo ?? 'anual';
  const totalSecciones = Number(carrera?.secciones ?? 1);

  const loadMaterias = useCallback(async () => {
    if (!carreraId) { setLoading(false); return; }
    try {
      setLoading(true);
      const response = await api.get(`/materias?carrera_id=${carreraId}`);
      const data = response.data?.data ?? response.data ?? [];
      const agrupadas = {};
      data.forEach((m) => {
        const sec = m.seccion ?? 'Sin sección';
        if (!agrupadas[sec]) agrupadas[sec] = [];
        agrupadas[sec].push(m);
      });
      setMateriasPorSeccion(agrupadas);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No fue posible cargar las materias.'));
    } finally {
      setLoading(false);
    }
  }, [carreraId]);

  useFocusEffect(useCallback(() => { loadMaterias(); }, [loadMaterias]));

  const handleDelete = (materia) => {
    Alert.alert('Eliminar materia', `¿Deseas eliminar "${materia.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try {
            await remove(materia.id);
            loadMaterias();
          } catch (error) {
            Alert.alert('Error', getErrorMessage(error, 'No fue posible eliminar la materia.'));
          }
        },
      },
    ]);
  };

  const secciones = Array.from({ length: totalSecciones }, (_, i) => {
    const numero = i + 1;
    const label = tipoCarrera === 'semestral' ? `${numero}º semestre` : `${numero}º año`;
    return { label, materias: materiasPorSeccion[label] ?? [] };
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A4E" />
      </View>
    );
  }

  if (!carreraId) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mis Materias</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#cbd5e1" />
          <Text style={styles.emptyText}>No tienes una carrera asignada</Text>
          <Text style={styles.emptySubtext}>Contacta al administrador</Text>
        </View>
        <BottomNav navigation={navigation} activeScreen="Materias" />
      </SafeAreaView>
    );
  }

  const renderSeccion = ({ item }) => (
    <View style={styles.seccionCard}>
      <Pressable
        style={styles.seccionHeader}
        onPress={() => navigation.navigate('MateriaForm', {
          seccionPreseleccionada: item.label,
          carrera, // ← pasar la carrera completa al form
        })}
      >
        <View style={styles.seccionLeft}>
          <View style={styles.seccionIconBg}>
            <Ionicons name="layers-outline" size={22} color="#d97706" />
          </View>
          <View>
            <Text style={styles.seccionLabel}>{item.label}</Text>
            <Text style={styles.seccionMeta}>
              {item.materias.length} {item.materias.length === 1 ? 'materia' : 'materias'}
            </Text>
          </View>
        </View>
        <View style={styles.addButton}>
          <Ionicons name="add" size={20} color="#4f46e5" />
          <Text style={styles.addButtonText}>Agregar</Text>
        </View>
      </Pressable>

      {item.materias.length > 0 && (
        <View style={styles.materiasContainer}>
          {item.materias.map((materia) => (
            <View key={materia.id} style={styles.materiaRow}>
              <View style={styles.materiaInfo}>
                <Ionicons name="book-outline" size={16} color="#4f46e5" />
                <Text style={styles.materiaNombre} numberOfLines={1}>{materia.nombre}</Text>
              </View>
              <View style={styles.materiaActions}>
                <Pressable style={styles.editBtn}
                  onPress={() => navigation.navigate('MateriaForm', { materia, carrera })}>
                  <Ionicons name="pencil-outline" size={15} color="#4f46e5" />
                </Pressable>
                <Pressable style={styles.deleteBtn} onPress={() => handleDelete(materia)}>
                  <Ionicons name="trash-outline" size={15} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{carrera?.nombre ?? 'Mis Materias'}</Text>
        <Text style={styles.headerSubtitle}>
          {totalSecciones} {tipoCarrera === 'semestral' ? 'semestres' : 'años'} · Gestiona las materias
        </Text>
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={secciones}
        keyExtractor={(item) => item.label}
        showsVerticalScrollIndicator={false}
        renderItem={renderSeccion}
      />
      <BottomNav navigation={navigation} activeScreen="Materias" />
    </SafeAreaView>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1A1A4E', padding: 24, paddingTop: 20, paddingBottom: 30,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    shadowColor: '#1A1A4E', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#c7d2fe', fontWeight: '500' },
  listContent: { padding: 20, paddingBottom: 120 },
  seccionCard: {
    backgroundColor: '#ffffff', borderRadius: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 3, overflow: 'hidden',
  },
  seccionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 18,
  },
  seccionLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  seccionIconBg: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#fffbeb', justifyContent: 'center', alignItems: 'center',
  },
  seccionLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  seccionMeta: { fontSize: 13, color: '#64748b', marginTop: 3 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#eef2ff', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12,
  },
  addButtonText: { fontSize: 13, fontWeight: '700', color: '#4f46e5' },
  materiasContainer: {
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    paddingHorizontal: 18, paddingBottom: 12,
  },
  materiaRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  materiaInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  materiaNombre: { fontSize: 14, fontWeight: '600', color: '#334155', flex: 1 },
  materiaActions: { flexDirection: 'row', gap: 8 },
  editBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center',
  },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center',
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#64748b', marginTop: 16, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#94a3b8', marginTop: 8, textAlign: 'center' },
};