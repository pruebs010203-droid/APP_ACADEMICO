import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  Text,
  View,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { getAll as getAllCarreras } from '../../services/carreraService';
import { getAll as getAllMaterias } from '../../services/materiaService';
import getErrorMessage from '../../utils/apiError';
import BottomNav from '../../components/BottomNav';
import HeaderConfigButton from '../../components/HeaderConfigButton';

export default function MateriasScreen({ navigation }) {
  const [carreras, setCarreras] = useState([]);
  const [materiasPorCarrera, setMateriasPorCarrera] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [carrerasData, materiasData] = await Promise.all([
        getAllCarreras(),
        getAllMaterias(),
      ]);

      // Agrupar materias por carrera_id
      const agrupadas = {};
      materiasData.forEach((m) => {
        const cid = m.carrera_id;
        if (!agrupadas[cid]) agrupadas[cid] = 0;
        agrupadas[cid]++;
      });

      setCarreras(carrerasData);
      setMateriasPorCarrera(agrupadas);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error, 'No fue posible cargar los datos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A4E" />
      </View>
    );
  }

  const renderCarrera = ({ item }) => {
    const totalMaterias = materiasPorCarrera[item.id] ?? 0;
    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('CarreraSecciones', { carrera: item })}
      >
        <View style={styles.cardLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name="school-outline" size={26} color="#4f46e5" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.nombre}</Text>
            <Text style={styles.cardMeta}>
              {item.secciones} {item.tipo === 'semestral' ? 'semestres' : 'años'}
            </Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          <View style={styles.materiaBadge}>
            <Text style={styles.materiaCount}>{totalMaterias}</Text>
            <Text style={styles.materiaLabel}>materias</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>Gestión de Materias</Text>
            <Text style={styles.headerSubtitle}>Selecciona una carrera para gestionar sus materias</Text>
          </View>
          <HeaderConfigButton navigation={navigation} />
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={carreras}
        keyExtractor={(item) => `${item.id}`}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="library-outline" size={60} color="#cbd5e1" />
            <Text style={styles.emptyText}>No hay carreras registradas</Text>
          </View>
        }
        renderItem={renderCarrera}
      />

      <BottomNav navigation={navigation} activeScreen="Materias" />
    </SafeAreaView>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#1A1A4E',
    padding: 24,
    paddingTop: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#1A1A4E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  headerTextBlock: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff', marginBottom: 6 },
  headerSubtitle: { fontSize: 14, color: '#c7d2fe', fontWeight: '500' },
  listContent: { padding: 20, paddingBottom: 120 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
  cardMeta: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  materiaBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  materiaCount: { fontSize: 18, fontWeight: '800', color: '#166534' },
  materiaLabel: { fontSize: 11, color: '#166534', fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#64748b', marginTop: 16 },
};