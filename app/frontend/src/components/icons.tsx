import {
  Archive, BookOpen, Calculator, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, EyeOff, FileText, Heart, HelpCircle,
  Home, Image as ImageIcon, Info, Languages, ListChecks, Lock, LogOut, Music, Pencil, Plus, RotateCcw, Search, Settings, Sparkles, Upload,
  ClipboardCheck, Eye, Users, TriangleAlert, LayoutGrid, User, UserCog, ScrollText, CalendarClock, CalendarDays, Clock, Shield, ArrowRight, School, Baby, GraduationCap, type LucideIcon,
} from "lucide-react";

const ICONS = {
  class: Home,
  reviews: ClipboardCheck,
  reports: FileText,
  questions: ListChecks,
  settings: Settings,
  write: Sparkles,
  photo: ImageIcon,
  camera: Camera,
  eng: BookOpen,
  chi: Languages,
  mat: Calculator,
  sed: Heart,
  enr: Music,
  notSeen: EyeOff,
  lock: Lock,
  check: Check,
  left: ChevronLeft,
  right: ChevronRight,
  up: ChevronUp,
  down: ChevronDown,
  plus: Plus,
  edit: Pencil,
  box: Archive,
  publish: Upload,
  restore: RotateCcw,
  info: Info,
  search: Search,
  logout: LogOut,
  eye: Eye,
  users: Users,
  classes: Users,
  children: Baby,
  teachers: GraduationCap,
  warn: TriangleAlert,
  overview: LayoutGrid,
  user: User,
  people: UserCog,
  activity: ScrollText,
  semester: CalendarClock,
  calendar: CalendarDays,
  timetable: Clock,
  shield: Shield,
  arrow: ArrowRight,
  school: School,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, stroke = 1.8, label }: { name: IconName | string; size?: number; stroke?: number; label?: string }) {
  const Glyph = ICONS[name as IconName] ?? HelpCircle;
  return <Glyph size={size} strokeWidth={stroke} {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} />;
}
