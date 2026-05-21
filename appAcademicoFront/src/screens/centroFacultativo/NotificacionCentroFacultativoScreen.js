import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { getRecibidas, getEnviadas, markAsRead, create } from '../../services/notificacionService';
import CentroFacultativoBottomNav from '../../components/CentroFacultativoBottomNav';

const PRIMARY = '#0369a1';

const DESTINOS = [
  { value: 'estudiantes', label: 'Estudiantes',       sub: 'Solo estudiantes de la facultad' },
  { value: 'todos',       label: 'Todos en la facultad', sub: 'Todos los usuarios de la facultad' },
];

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function NotifCard({ item, tab, onPress }) {
  const unread = tab === 'recibidas' && !item.leida;
  return (
    <Pressable
      style={({ pressed }) => [s.card, unread && s.cardUnread, pressed && s.cardPressed]}
      onPress={onPress}
    >
      <View style={s.cardTop}>
        <View style={s.iconBox}>
          <Ionicons name="notifications-outline" size={22} color={PRIMARY} />
          {unread && <View style={s.unreadDot} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{item.titulo}</Text>
          <Text style={s.cardBody} numberOfLines={2}>{item.cuerpo}</Text>
        </View>
      </View>
      <View style={s.cardFooter}>
        {tab === 'recibidas' && (
          <View style={[s.pill, item.leida ? s.pillRead : s.pillUnread]}>
            <Ionicons
              name={item.leida ? 'checkmark-done-outline' : 'ellipse'}
              size={11}
              color={item.leida ? '#059669' : '#dc2626'}
            />
            <Text style={[s.pillText, item.leida ? s.pillTextRead : s.pillTextUnread]}>
              {item.leida ? 'Leída' : 'No leída'}
            </Text>
          </View>
        )}
        <Text style={s.meta}>{formatDate(item.created_at)}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificacionCentroFacultativoScreen({ navigation }) {
  const { usuario } = useAuth();
  const facultadId     = usuario?.facultad_id || usuario?.carrera?.facultad?.id;
  const facultadNombre = usuario?.facultad?.nombre || usuario?.carrera?.facultad?.nombre || 'tu facultad';

  const [tab,       setTab]       = useState('recibidas');
  const [recibidas, setRecibidas] = useState([]);
  const [enviadas,  setEnviadas]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [detalle,   setDetalle]   = useState(null);

  // Nueva notificación
  const [titulo,          setTitulo]          = useState('');
  const [cuerpo,          setCuerpo]          = useState('');
  const [destino,         setDestino]         = useState('estudiantes');
  const [sending,         setSending]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [carrerasFacultad, setCarrerasFacultad] = useState([]);

  useEffect(() => {
    if (!facultadId) return;
    api.get('/carreras').then((res) => {
      const data = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      setCarrerasFacultad(data.filter((c) => String(c.facultad_id || c?.facultad?.id) === String(facultadId)));
    }).catch(() => setCarrerasFacultad([]));
  }, [facultadId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rec, env] = await Promise.all([getRecibidas(), getEnviadas()]);
      setRecibidas(Array.isArray(rec) ? rec : []);
      setEnviadas(Array.isArray(env) ? env : []);
    } catch (e) {
      console.error('Error cargando notificaciones:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const openDetail = async (item) => {
    const readItem = { ...item, leida: true, leido_en: item.leido_en || new Date().toISOString() };
    setDetalle(readItem);
    if (tab !== 'recibidas' || item.leida) return;
    setRecibidas((prev) => prev.map((n) => n.id === item.id ? readItem : n));
    try {
      const result = await markAsRead(item.id);
      const updated = { ...readItem, leido_en: result?.leido_en || readItem.leido_en };
      setDetalle((cur) => cur?.id === item.id ? updated : cur);
      setRecibidas((prev) => prev.map((n) => n.id === item.id ? updated : n));
    } catch (e) {
      console.log('Error marcando leída:', e?.response?.data || e.message);
    }
  };

  const handleSend = () => {
    if (!titulo.trim() || !cuerpo.trim()) {
      Alert.alert('Validación', 'Título y mensaje son obligatorios.');
      return;
    }
    setShowConfirm(true);
  };

  const confirmSend = async () => {
    setShowConfirm(false);
    try {
      setSending(true);
      const payload = { titulo: titulo.trim(), cuerpo: cuerpo.trim(), rol_destino: destino };
      const ids = carrerasFacultad.map((c) => c.id).filter(Boolean);
      if (ids.length > 0) payload.carrera_ids = ids;
      await create(payload);
      setTitulo('');
      setCuerpo('');
      Alert.alert('✓ Enviada', 'Notificación enviada correctamente.', [
        { text: 'OK', onPress: () => { loadData(); setTab('enviadas'); } },
      ]);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message ?? 'No se pudo enviar.');
    } finally {
      setSending(false);
    }
  };

  const listData = tab === 'recibidas' ? recibidas : enviadas;

  return (
    <SafeAreaView style={s.screen}>

      {/* ── Modal confirmación ── */}
      <Modal transparent visible={showConfirm} animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={s.overlay}>
          <View style={s.dialog}>
            <View style={s.dialogIcon}>
              <Ionicons name="notifications" size={28} color={PRIMARY} />
            </View>
            <Text style={s.dialogTitle}>Confirmar envío</Text>
            <Text style={s.dialogBody}>
              Se enviará{'\n'}
              <Text style={{ fontWeight: '800', color: PRIMARY }}>"{titulo}"</Text>
              {'\n'}a <Text style={{ fontWeight: '800' }}>{destino === 'estudiantes' ? 'los estudiantes' : 'todos'}</Text> de{'\n'}
              <Text style={{ fontWeight: '800', color: PRIMARY }}>{facultadNombre}</Text>
            </Text>
            <View style={s.dialogActions}>
              <Pressable style={s.btnCancel} onPress={() => setShowConfirm(false)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={s.btnConfirm} onPress={confirmSend}>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={s.btnConfirmText}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal detalle ── */}
      <Modal visible={!!detalle} transparent animationType="fade" onRequestClose={() => setDetalle(null)}>
        <Pressable style={s.overlay} onPress={() => setDetalle(null)}>
          <Pressable style={s.detailModal} onPress={(e) => e.stopPropagation()}>
            <Pressable style={s.closeBtn} onPress={() => setDetalle(null)}>
              <Ionicons name="close-outline" size={24} color="#64748b" />
            </Pressable>
            <ScrollView contentContainerStyle={s.detailContent} showsVerticalScrollIndicator={false}>
              <View style={s.detailHeader}>
                <View style={s.detailIconBox}>
                  <Ionicons name="notifications" size={22} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.detailTitle}>{detalle?.titulo}</Text>
                  <Text style={s.detailDate}>{formatDate(detalle?.created_at)}</Text>
                </View>
              </View>
              {tab === 'recibidas' && (
                <View style={[s.pill, s.pillRead]}>
                  <Ionicons name="checkmark-done-outline" size={14} color="#059669" />
                  <Text style={[s.pillText, s.pillTextRead]}>Leída</Text>
                </View>
              )}
              <Text style={s.detailLabel}>Mensaje</Text>
              <View style={s.msgBox}>
                <Text style={s.detailBody}>{detalle?.cuerpo}</Text>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.circleOne} />
        <View style={s.circleTwo} />
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Centro Facultativo</Text>
            <Text style={s.headerTitle}>Notificaciones</Text>
            {facultadNombre ? (
              <View style={s.badge}>
                <Ionicons name="business-outline" size={13} color="#bae6fd" />
                <Text style={s.badgeText}>{facultadNombre}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={s.tabs}>
        {['recibidas', 'enviadas', 'nueva'].map((t) => (
          <Pressable
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'recibidas' ? 'Recibidas' : t === 'enviadas' ? 'Enviadas' : 'Nueva'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Contenido ── */}
      {tab === 'nueva' ? (
        <ScrollView contentContainerStyle={s.formScroll} showsVerticalScrollIndicator={false}>
          <View style={s.card2}>
            <Text style={s.sectionLabel}>Destinatarios</Text>
            <View style={s.radioGroup}>
              {DESTINOS.map((item) => (
                <Pressable
                  key={item.value}
                  style={[s.radioOption, destino === item.value && s.radioOptionActive]}
                  onPress={() => setDestino(item.value)}
                >
                  <View style={[s.radioDot, destino === item.value && s.radioDotActive]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.radioTitle}>{item.label}</Text>
                    <Text style={s.radioSub}>{item.sub}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={s.card2}>
            <Text style={s.sectionLabel}>Contenido</Text>
            <Text style={s.fieldLabel}>Título <Text style={{ color: '#ef4444' }}>*</Text></Text>
            <TextInput
              style={s.input}
              placeholder="Título de la notificación"
              placeholderTextColor="#94a3b8"
              value={titulo}
              onChangeText={setTitulo}
              maxLength={120}
            />
            <Text style={s.charCount}>{titulo.length}/120</Text>
            <Text style={s.fieldLabel}>Mensaje <Text style={{ color: '#ef4444' }}>*</Text></Text>
            <TextInput
              style={[s.input, s.textArea]}
              placeholder="Describe el comunicado..."
              placeholderTextColor="#94a3b8"
              value={cuerpo}
              onChangeText={setCuerpo}
              multiline
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={({ pressed }) => [s.sendBtn, pressed && { opacity: 0.88 }, sending && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={s.sendBtnText}>Enviar notificación</Text>
              </>
            )}
          </Pressable>
          <View style={{ height: 100 }} />
        </ScrollView>
      ) : loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="notifications-off-outline" size={40} color="#cbd5e1" />
              <Text style={s.emptyText}>No hay notificaciones {tab}.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <NotifCard item={item} tab={tab} onPress={() => openDetail(item)} />
          )}
        />
      )}

      <CentroFacultativoBottomNav navigation={navigation} active="NotificacionFacultativo" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    backgroundColor: PRIMARY,
    padding: 24, paddingTop: 44,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    overflow: 'hidden', marginBottom: 16,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25, shadowRadius: 15, elevation: 8,
  },
  circleOne: {
    position: 'absolute', width: 150, height: 150, borderRadius: 80,
    top: -40, right: -30, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  circleTwo: {
    position: 'absolute', width: 90, height: 90, borderRadius: 45,
    bottom: 10, left: 20, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting:    { fontSize: 13, color: '#bae6fd', fontWeight: '500' },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#fff', marginVertical: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 5, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 20,
  },
  badgeText: { color: '#e0f2fe', fontWeight: '700', fontSize: 12 },

  tabs: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 12,
    backgroundColor: '#e2e8f0', borderRadius: 18, padding: 6,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 14 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { color: '#64748b', fontWeight: '800', fontSize: 13 },
  tabTextActive: { color: PRIMARY },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: '#94a3b8', fontWeight: '700', fontSize: 15 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 3,
  },
  cardUnread: { borderWidth: 1.5, borderColor: '#bae6fd', backgroundColor: '#f0f9ff' },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconBox: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  unreadDot: {
    position: 'absolute', top: -3, right: -3,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#dc2626', borderWidth: 2, borderColor: '#fff',
  },
  cardTitle: { color: '#0f172a', fontWeight: '900', fontSize: 15 },
  cardBody:  { color: '#64748b', marginTop: 4, lineHeight: 19, fontSize: 13 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  pillUnread: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  pillRead:   { backgroundColor: '#ecfdf5', borderColor: '#bbf7d0' },
  pillText: { fontSize: 11, fontWeight: '900' },
  pillTextUnread: { color: '#dc2626' },
  pillTextRead:   { color: '#059669' },
  meta: { color: '#94a3b8', fontWeight: '700', fontSize: 12 },

  // Formulario
  formScroll: { paddingHorizontal: 20, paddingTop: 4 },
  card2: {
    backgroundColor: '#fff', borderRadius: 22, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 3,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14,
  },
  radioGroup: { gap: 10 },
  radioOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  radioOptionActive: { backgroundColor: '#eff6ff', borderColor: '#bae6fd' },
  radioDot: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 2,
    borderColor: '#94a3b8', backgroundColor: '#fff',
  },
  radioDotActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  radioTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  radioSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#f8fafc', fontSize: 15, color: '#0f172a', marginBottom: 4,
  },
  textArea:  { minHeight: 130, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textAlign: 'right', marginBottom: 14 },
  sendBtn: {
    backgroundColor: PRIMARY, borderRadius: 18, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // Modal detalle
  overlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  detailModal: {
    width: '100%', maxHeight: '80%',
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 16, zIndex: 5,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9',
  },
  detailContent: { padding: 22, paddingTop: 26, paddingBottom: 32 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingRight: 42 },
  detailIconBox: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center',
  },
  detailTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', lineHeight: 26 },
  detailDate:  { color: '#94a3b8', fontWeight: '700', marginTop: 4 },
  detailLabel: { color: '#475569', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  msgBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16 },
  detailBody: { color: '#334155', fontSize: 15, lineHeight: 22 },

  // Modal confirmación
  dialog: {
    width: '90%', maxWidth: 360,
    backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
    alignSelf: 'center',
  },
  dialogIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  dialogTitle:   { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  dialogBody:    { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  dialogActions: { flexDirection: 'row', gap: 12, width: '100%' },
  btnCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#f1f5f9', alignItems: 'center',
  },
  btnCancelText: { fontSize: 15, fontWeight: '700', color: '#475569' },
  btnConfirm: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: PRIMARY,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnConfirmText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
