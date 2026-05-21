import api from '../api/axios';

export const getAll = async () => {
  const response = await api.get('/carreras');
  // El backend puede devolver directamente un array o { data: [...] }
  return Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
};

export const getOne = async (id) => {
  const response = await api.get(`/carreras/${id}`);
  return response.data;
};

export const create = async (data) => {
  try {
    console.log('carreraService.create payload', data);
  } catch (e) {}
  const response = await api.post('/carreras', data);
  try { console.log('carreraService.create response', response?.data); } catch (e) {}
  return response.data;
};

export const update = async (id, data) => {
  try { console.log('carreraService.update payload', id, data); } catch (e) {}
  const response = await api.put(`/carreras/${id}`, data);
  try { console.log('carreraService.update response', response?.data); } catch (e) {}
  return response.data;
};

export const remove = async (id) => {
  const response = await api.delete(`/carreras/${id}`);
  return response.data;
};

export default {
  getAll,
  getOne,
  create,
  update,
  remove,
};
