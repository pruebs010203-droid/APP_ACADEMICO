import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { getAll as getAllMaterias } from '../../services/materiaService';
import getErrorMessage from '../../utils/apiError';

export default function CarreraSeccionesScreen({ navigation, route }) {
  const { carrera } = route.params;
  const [materiasPorSeccion, setMateriasPorSeccion] = useState({});
  const [loading, setLoading] = useState(true);

  const loadMaterias = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllMaterias({ carrera_id: carrera.id });

      // Agrupar por seccion
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
  }, [carrera.id]);

  useFocusEffect(useCallback(() => { loadMaterias(); }, [loadMaterias]));

  // Generar todas las secciones de la carrera aunque estén vacías
  const secciones = Array.from({ length: carrera.secciones ?? 1 }, (_, i) => {
    const numero = i + 1;
    const label = carrera.tipo === 'semestral'
      ? `${numero}º semestre`
      : `${numero}º año`;
    return { label, materias: materiasPorSeccion[label] ?? [] };
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1A1A4E" />
      </View>
    );
  }

  const renderSeccion = ({ item }) => (
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate('MateriaForm', {
        carrera,
        seccionPreseleccionada: item.label,
      })}
    >
      <View style={styles.cardLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name="layers-outline" size={24} color="#d97706" />
        </View>
        <View>
          <Text style={styles.seccionLabel}>{item.label}</Text>
          <Text style={styles.seccionMeta}>
            {item.materias.length} {item.materias.length === 1 ? 'materia' : 'materias'}
          </Text>
        </View>
      </View>

      <View style={styles.cardRight}>
        {item.materias.length > 0 && (
          <View style={styles.materiasPreview}>
            {item.materias.slice(0, 2).map((m) => (
              <Text key={m.id} style={styles.materiaChip} numberOfLines={1}>
                {m.nombre}
              </Text>
            ))}
            {item.materias.length > 2 && (
              <Text style={styles.materiaChipMore}>+{item.materias.length - 2} más</Text>
            )}
          </View>
        )}
        <Ionicons name="add-circle-outline" size={28} color="#4f46e5" style={{ marginLeft: 8 }} />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{carrera.nombre}</Text>
          <Text style={styles.headerSubtitle}>
            Selecciona un {carrera.tipo === 'semestral' ? 'semestre' : 'año'} para agregar materias
          </Text>
        </View>
        <View style={styles.headerIconBg}>
          <Ionicons name="school-outline" size={24} color="#ffffff" />
        </View>
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={secciones}
        keyExtractor={(item) => item.label}
        showsVerticalScrollIndicator={false}
        renderItem={renderSeccion}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#1A1A4E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headerBack: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  headerSubtitle: { fontSize: 13, color: '#c7d2fe', marginTop: 4, fontWeight: '500' },
  headerIconBg: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginLeft: 16,
  },
  listContent: { padding: 20, paddingBottom: 40 },
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
    width: 50, height: 50, borderRadius: 16,
    backgroundColor: '#fffbeb',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  seccionLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  seccionMeta: { fontSize: 13, color: '#64748b', marginTop: 3 },
  cardRight: { flexDirection: 'row', alignItems: 'center' },
  materiasPreview: { alignItems: 'flex-end', maxWidth: 140 },
  materiaChip: {
    fontSize: 11, color: '#4f46e5', fontWeight: '600',
    backgroundColor: '#eef2ff', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4,
  },
  materiaChipMore: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
};