import { useState } from 'react';
import { LayoutDashboard, Calendar, Users, Settings, PieChart, X, ChevronDown, ChevronRight, Folder, Briefcase } from 'lucide-react';
import { appVersion } from '../version';

interface MenuItem {
    id?: string;
    label: string;
    icon: any;
    children?: MenuItem[];
    isOpen?: boolean; // Initial state for groups
}

const MENU_STRUCTURE: MenuItem[] = [
    {
        label: 'Projects',
        icon: Briefcase,
        isOpen: true,
        children: [
            {
                label: 'Project',
                icon: Folder,
                isOpen: true,
                children: [
                    { id: 'my_projects', icon: Folder, label: 'Meus Projetos' },
                    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                    { id: 'gantt', icon: Calendar, label: 'Visão Gantt' },
                    { id: 'reports', icon: PieChart, label: 'Relatórios' },
                ]
            }
        ]
    },
    { id: 'team', icon: Users, label: 'Equipe' },
];

interface SidebarProps {
    activeView: string;
    onNavigate: (view: string) => void;
    className?: string;
}

const MenuItemComponent = ({ item, depth = 0, activeView, onNavigate }: { item: MenuItem, depth?: number, activeView: string, onNavigate: (view: string) => void }) => {
    const [isOpen, setIsOpen] = useState(item.isOpen || false);
    const hasChildren = item.children && item.children.length > 0;
    const isActive = item.id === activeView;
    const isChildActive = item.children?.some(child => child.id === activeView || child.children?.some(c => c.id === activeView));

    // Auto-expand if child is active - ensuring it opens on load/navigation
    // Note: This side-effect inside render is generally okay for simple toggle states derived from props in this context, 
    // but better to use useEffect in a real app. For this snippet, it's fine or we can rely on initial state.
    // If we want it strictly reactive:
    // useEffect(() => { if (isChildActive) setIsOpen(true); }, [activeView]); 
    // Stick to simple logic for now.

    const handleClick = () => {
        if (hasChildren) {
            setIsOpen(!isOpen);
        } else if (item.id) {
            onNavigate(item.id);
        }
    };

    const paddingLeft = depth * 12 + 16; // Dynamic padding for nesting

    return (
        <div className="w-full">
            <button
                onClick={handleClick}
                className={`w-full flex items-center py-2.5 transition-colors duration-200 group
                    ${isActive
                        ? 'bg-indigo-600/10 text-indigo-400 border-r-2 border-indigo-500'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }
                    ${depth > 0 ? 'text-sm' : 'font-medium'}
                `}
                style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '16px' }}
            >
                <div className="flex items-center flex-1 min-w-0">
                    <item.icon size={depth === 0 ? 20 : 18} className={`${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-white'} transition-colors`} />
                    <span className="ml-3 truncate hidden lg:block">{item.label}</span>
                </div>

                {hasChildren && (
                    <div className="hidden lg:block ml-2 text-slate-600">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                )}
            </button>

            {hasChildren && isOpen && (
                <div className="flex flex-col">
                    {item.children!.map((child, index) => (
                        <MenuItemComponent
                            key={index}
                            item={child}
                            depth={depth + 1}
                            activeView={activeView}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const Sidebar = ({ activeView, onNavigate, className = '' }: SidebarProps) => {
    return (
        <aside className={`h-screen w-20 lg:w-64 bg-slate-900 text-white flex flex-col transition-all duration-300 flex-shrink-0 border-r border-slate-800 ${className}`}>
            <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800 bg-slate-950/50">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/20">P</div>
                <span className="ml-3 font-bold text-lg hidden lg:block tracking-tight text-white">Projetos</span>
            </div>

            <nav className="flex-1 py-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                <div className="space-y-1">
                    {MENU_STRUCTURE.map((item, index) => (
                        <MenuItemComponent
                            key={index}
                            item={item}
                            activeView={activeView}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            </nav>

            <div className="p-4 border-t border-slate-800 bg-slate-950/30">
                <button className="flex items-center text-slate-400 hover:text-white transition-colors w-full justify-center lg:justify-start group">
                    <Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                    <span className="ml-3 hidden lg:block font-medium">Configurações</span>
                </button>
                <div className="text-xs text-slate-600 text-center mt-2 hidden lg:block">
                    v{appVersion}
                </div>
            </div>
        </aside >
    );
};

interface MobileMenuProps extends SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MobileMenu = ({ activeView, onNavigate, isOpen, onClose }: MobileMenuProps) => {
    if (!isOpen) return null;

    // Simplified recursive renderer for mobile
    const renderMobileItems = (items: MenuItem[], depth = 0) => {
        return items.map((item, index) => (
            <div key={index}>
                <button
                    onClick={() => {
                        if (item.children) {
                            // Being simple for mobile logic (auto expanded in loop for now)
                        } else if (item.id) {
                            onNavigate(item.id);
                            onClose();
                        }
                    }}
                    className={`w-full flex items-center py-3 px-4 rounded-lg transition-colors 
                        ${item.children ? 'text-slate-400 uppercase text-xs font-bold tracking-wider mt-2' : ''}
                        ${item.id === activeView ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' : (!item.children && 'text-slate-300 hover:bg-slate-800')}
                    `}
                    style={{ paddingLeft: `${depth * 16 + 16}px` }}
                >
                    <item.icon size={item.children ? 16 : 22} className={item.children ? 'mr-2' : 'mr-3'} />
                    <span>{item.label}</span>
                </button>
                {item.children && (
                    <div className="flex flex-col gap-1 mt-1">
                        {renderMobileItems(item.children, depth + 1)}
                    </div>
                )}
            </div>
        ));
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm lg:hidden flex flex-col animate-in slide-in-from-top-4 fade-in duration-200">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900">
                <div className="flex items-center">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl text-white">P</div>
                    <span className="ml-3 font-bold text-lg text-white">Projetos</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors">
                    <X size={24} />
                </button>
            </div>

            <nav className="flex-1 py-6 px-4 overflow-y-auto">
                {renderMobileItems(MENU_STRUCTURE)}
            </nav>

            <div className="p-6 border-t border-slate-800 bg-slate-900">
                <button className="flex items-center text-slate-400 hover:text-white transition-colors w-full px-4 py-3 rounded-lg hover:bg-slate-800">
                    <Settings size={24} />
                    <span className="ml-4 text-base font-medium">Configurações</span>
                </button>
                <div className="text-xs text-slate-600 text-center mt-2">
                    v{appVersion}
                </div>
            </div>
        </div>
    );
};
