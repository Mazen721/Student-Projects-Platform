import crypto from 'node:crypto';
import mongoose from 'mongoose';

export const NOW = new Date();
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function daysAgo(days, hoursOffset = 0) {
  return new Date(NOW.getTime() - days * DAY_MS - hoursOffset * HOUR_MS);
}

export function daysFromNow(days, hoursOffset = 0) {
  return new Date(NOW.getTime() + days * DAY_MS + hoursOffset * HOUR_MS);
}

export function cairoDayString(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(date);
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function makeImageRef(key, url, originalName = 'image.jpg') {
  return {
    publicId: `spp/seed/${key}`,
    url,
    resourceType: 'image',
    deliveryType: 'upload',
    format: 'jpg',
    bytes: 245760,
    originalName,
  };
}

export function makeDocRef(key, originalName, format = 'pdf', bytes = 842100) {
  return {
    publicId: `spp/seed/docs/${key}`,
    url: `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`,
    resourceType: format === 'pdf' ? 'image' : 'raw',
    deliveryType: 'upload',
    format,
    bytes,
    originalName,
  };
}

// Curated high-resolution Unsplash images matching each project domain
export const SEED_IMAGES = Object.freeze({
  universityLogo:
    'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=400&q=80',
  retinaAi:
    'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=80',
  retinaAi2:
    'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=1200&q=80',
  robotArm:
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
  robotArm2:
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80',
  solarGrid:
    'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
  solarGrid2:
    'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1200&q=80',
  fintech:
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
  fintech2:
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
  pharmacy:
    'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80',
  droneAgri:
    'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80',
  architecture:
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
  icuMonitor:
    'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80',
  ecommerce:
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80',
  cybersec:
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
  medicalApp:
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80',
  medWaste:
    'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1200&q=80',
  waterRobot:
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  diabetesCds:
    'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80',
  crowdfund:
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
});

export async function wipeCollectionsForReset() {
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  const skip = new Set(['joblocks']);
  for (const col of cols) {
    if (skip.has(col.name)) continue;
    await db.collection(col.name).deleteMany({});
  }
}

export async function backdateCreatedAt(Model, id, date) {
  await Model.collection.updateOne(
    { _id: id },
    { $set: { createdAt: date, updatedAt: date } }
  );
}
