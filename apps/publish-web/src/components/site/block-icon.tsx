import {
  Apple, Baby, Bath, BedDouble, Beer, Book, Briefcase, Building2, Cake, Calendar, Camera, Car, Cctv, ChartLine, CircleCheck, Clock, Cloud, Coffee, CreditCard, CupSoda, Database, Dumbbell, Factory, Flower2, Fuel, Gamepad2, Gem, Gift, Globe, GraduationCap, Headphones, Heart, HeartPulse, Hotel, IceCreamCone, Laptop, Leaf, Lightbulb, MapPin, Mic, Monitor, Music, Package, PawPrint, Percent, Pill, Pizza, Plane, PlugZap, Printer, QrCode, Receipt, Rocket, Router, ScanBarcode, Scissors, Server, Settings, Shirt, ShieldCheck, ShoppingCart, Smartphone, Sofa, Sparkles, Star, Stethoscope, Store, Tablet, Tag, Target, Tent, Ticket, Truck, Users, Utensils, UtensilsCrossed, Wallet, Warehouse, Wifi, Wine, Wrench, Zap, type LucideIcon, type LucideProps,
} from "lucide-react";
import type { BlockIcon as BlockIconName } from "@iorder/core/server/shared/block-icons";

// Mã biểu tượng lưu trong khối trang → icon lucide (cùng bảng với CMS: apps/cms/src/components/admin/ui/block-icon.tsx).
const icons: Record<BlockIconName, LucideIcon> = {
  store: Store, shirt: Shirt, smartphone: Smartphone, "shopping-cart": ShoppingCart, sparkles: Sparkles, wrench: Wrench, pill: Pill, gem: Gem, gift: Gift, baby: Baby, book: Book, sofa: Sofa, apple: Apple, "paw-print": PawPrint, car: Car, fuel: Fuel, warehouse: Warehouse, truck: Truck, package: Package,
  utensils: Utensils, "utensils-crossed": UtensilsCrossed, coffee: Coffee, "cup-soda": CupSoda, beer: Beer, wine: Wine, pizza: Pizza, cake: Cake, "ice-cream": IceCreamCone, music: Music, mic: Mic, gamepad: Gamepad2, ticket: Ticket,
  flower: Flower2, scissors: Scissors, "bed-double": BedDouble, hotel: Hotel, tent: Tent, dumbbell: Dumbbell, stethoscope: Stethoscope, "heart-pulse": HeartPulse, "graduation-cap": GraduationCap, bath: Bath, plane: Plane, briefcase: Briefcase, building: Building2, factory: Factory,
  monitor: Monitor, laptop: Laptop, tablet: Tablet, printer: Printer, "scan-barcode": ScanBarcode, receipt: Receipt, "credit-card": CreditCard, "qr-code": QrCode, wifi: Wifi, router: Router, cctv: Cctv, camera: Camera, server: Server, "plug-zap": PlugZap, zap: Zap, database: Database, cloud: Cloud,
  "shield-check": ShieldCheck, "circle-check": CircleCheck, star: Star, heart: Heart, users: Users, clock: Clock, calendar: Calendar, "chart-line": ChartLine, target: Target, rocket: Rocket, lightbulb: Lightbulb, settings: Settings, "map-pin": MapPin, globe: Globe, headphones: Headphones, tag: Tag, percent: Percent, wallet: Wallet, leaf: Leaf,
};

export function BlockIcon({ name, ...props }: { name: BlockIconName } & LucideProps) {
  const Icon = icons[name];
  return Icon ? <Icon aria-hidden="true" {...props} /> : null;
}
