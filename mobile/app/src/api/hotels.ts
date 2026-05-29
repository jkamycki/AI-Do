import type { HotelBlock } from '../types';
import { mobileAuthFetch } from './mobileAuth';

type BackendHotel = {
  address?: string | null;
  bookingLink?: string | null;
  city?: string | null;
  cutoffDate?: string | null;
  email?: string | null;
  hotelName?: string | null;
  id: number | string;
  phone?: string | null;
  pricePerNight?: number | string | null;
  roomsBooked?: number | null;
  roomsReserved?: number | null;
  state?: string | null;
};

type HotelSyncResult = {
  hotel?: HotelBlock;
  synced: boolean;
};

function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isBackendId(id: string) {
  return /^\d+$/.test(id);
}

function hotelPayload(hotel: HotelBlock) {
  const contact = hotel.contact.trim();
  return {
    address: hotel.address.trim() || null,
    bookingLink: null,
    cutoffDate: hotel.deadline || null,
    email: contact.includes('@') ? contact : null,
    hotelName: hotel.name.trim(),
    phone: contact && !contact.includes('@') ? contact : null,
    pricePerNight: hotel.rate,
    roomsBooked: hotel.roomsBooked,
    roomsReserved: hotel.roomsTotal,
  };
}

function toMobileHotel(hotel: BackendHotel, fallback?: HotelBlock): HotelBlock {
  const address = [hotel.address, hotel.city, hotel.state].filter(Boolean).join(', ');
  return {
    address: address || fallback?.address || '',
    contact: hotel.email?.trim() || hotel.phone?.trim() || fallback?.contact || '',
    deadline: hotel.cutoffDate || fallback?.deadline || '',
    id: String(hotel.id ?? fallback?.id ?? `hotel-${Date.now()}`),
    name: hotel.hotelName?.trim() || fallback?.name || 'Hotel block',
    rate: money(hotel.pricePerNight ?? fallback?.rate),
    roomsBooked: Number(hotel.roomsBooked ?? fallback?.roomsBooked ?? 0),
    roomsTotal: Number(hotel.roomsReserved ?? fallback?.roomsTotal ?? hotel.roomsBooked ?? 0),
    shuttle: fallback?.shuttle ?? false,
  };
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.error || body.message || 'Hotel sync failed.';
  } catch {
    return 'Hotel sync failed.';
  }
}

export async function createMobileHotel(hotel: HotelBlock): Promise<HotelSyncResult> {
  const response = await mobileAuthFetch('/api/hotels', {
    body: JSON.stringify(hotelPayload(hotel)),
    method: 'POST',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { hotel: toMobileHotel((await response.json()) as BackendHotel, hotel), synced: true };
}

export async function updateMobileHotel(hotel: HotelBlock): Promise<HotelSyncResult> {
  if (!isBackendId(hotel.id)) return { synced: false };
  const response = await mobileAuthFetch(`/api/hotels/${hotel.id}`, {
    body: JSON.stringify(hotelPayload(hotel)),
    method: 'PATCH',
  });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { hotel: toMobileHotel((await response.json()) as BackendHotel, hotel), synced: true };
}

export async function deleteMobileHotel(hotelId: string): Promise<{ synced: boolean }> {
  if (!isBackendId(hotelId)) return { synced: false };
  const response = await mobileAuthFetch(`/api/hotels/${hotelId}`, { method: 'DELETE' });
  if (!response) return { synced: false };
  if (!response.ok) throw new Error(await readError(response));
  return { synced: true };
}
