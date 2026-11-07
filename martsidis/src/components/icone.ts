/**
 * Icone Lucide (licenza ISC) importate come SVG grezzi: finiscono inline nell'HTML,
 * zero JavaScript e zero richieste in più. Per aggiungerne una: importarla qui e aggiungerla a `icone`.
 * Elenco completo: https://lucide.dev/icons
 */
import activity from 'lucide-static/icons/activity.svg?raw';
import arrowRight from 'lucide-static/icons/arrow-right.svg?raw';
import award from 'lucide-static/icons/award.svg?raw';
import baby from 'lucide-static/icons/baby.svg?raw';
import building2 from 'lucide-static/icons/building-2.svg?raw';
import calendarCheck from 'lucide-static/icons/calendar-check.svg?raw';
import check from 'lucide-static/icons/check.svg?raw';
import chevronDown from 'lucide-static/icons/chevron-down.svg?raw';
import circleHelp from 'lucide-static/icons/circle-help.svg?raw';
import clock from 'lucide-static/icons/clock.svg?raw';
import droplets from 'lucide-static/icons/droplets.svg?raw';
import externalLink from 'lucide-static/icons/external-link.svg?raw';
import flower2 from 'lucide-static/icons/flower-2.svg?raw';
import graduationCap from 'lucide-static/icons/graduation-cap.svg?raw';
import handHeart from 'lucide-static/icons/hand-heart.svg?raw';
import heartHandshake from 'lucide-static/icons/heart-handshake.svg?raw';
import hospital from 'lucide-static/icons/hospital.svg?raw';
import info from 'lucide-static/icons/info.svg?raw';
import languages from 'lucide-static/icons/languages.svg?raw';
import map from 'lucide-static/icons/map.svg?raw';
import mapPin from 'lucide-static/icons/map-pin.svg?raw';
import menu from 'lucide-static/icons/menu.svg?raw';
import messageCircle from 'lucide-static/icons/message-circle.svg?raw';
import navigation from 'lucide-static/icons/navigation.svg?raw';
import phone from 'lucide-static/icons/phone.svg?raw';
import scanLine from 'lucide-static/icons/scan-line.svg?raw';
import shieldCheck from 'lucide-static/icons/shield-check.svg?raw';
import stethoscope from 'lucide-static/icons/stethoscope.svg?raw';
import users from 'lucide-static/icons/users.svg?raw';
import waves from 'lucide-static/icons/waves.svg?raw';
import x from 'lucide-static/icons/x.svg?raw';

/** Estrae solo il contenuto interno (<path>, <circle>…) dallo SVG di Lucide. */
const interno = (svg: string) =>
  svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s*\n\s*/g, '')
    .trim();

// Glifo WhatsApp da Simple Icons (CC0). Lucide non include marchi.
const whatsapp =
  '<path fill="currentColor" stroke="none" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>';

export const icone = {
  activity: interno(activity),
  'arrow-right': interno(arrowRight),
  award: interno(award),
  baby: interno(baby),
  'building-2': interno(building2),
  'calendar-check': interno(calendarCheck),
  check: interno(check),
  'chevron-down': interno(chevronDown),
  'circle-help': interno(circleHelp),
  clock: interno(clock),
  droplets: interno(droplets),
  'external-link': interno(externalLink),
  'flower-2': interno(flower2),
  'graduation-cap': interno(graduationCap),
  'hand-heart': interno(handHeart),
  'heart-handshake': interno(heartHandshake),
  hospital: interno(hospital),
  info: interno(info),
  languages: interno(languages),
  map: interno(map),
  'map-pin': interno(mapPin),
  menu: interno(menu),
  'message-circle': interno(messageCircle),
  navigation: interno(navigation),
  phone: interno(phone),
  'scan-line': interno(scanLine),
  'shield-check': interno(shieldCheck),
  stethoscope: interno(stethoscope),
  users: interno(users),
  waves: interno(waves),
  whatsapp,
  x: interno(x),
} as const;

export type NomeIcona = keyof typeof icone;
