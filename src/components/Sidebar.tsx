
import { useState, useMemo } from 'react';
import { LayoutDashboard, Calendar, Users, Settings, PieChart, ChevronDown, ChevronRight, Folder, Building2, UserCircle } from 'lucide-react';
import { appVersion } from '../version';
import { Client } from '../types/client';
import { Project } from '../types';
import { AppUser } from '../types/auth';

interface MenuItem {
    id?: string;
    label: string;
    icon: any;
    children?: MenuItem[];
    isOpen?: boolean;
    isDynamic?: boolean; // Useful if we want to force open/close behavior logic specific to dynamic items
    action?: () => void;
}

interface SidebarProps {
    activeView: string;
    onNavigate: (view: string) => void;
    className?: string;
    clients?: Client[];
    projects?: Project[];
    currentUser?: AppUser | null;
}

const MenuItemComponent = ({ item, activeView, onNavigate, level = 0 }: { item: MenuItem, activeView: string, onNavigate: (v: string) => void, level?: number }) => {
    const [isExpanded, setIsExpanded] = useState(item.isOpen || false);

    // Check if this item is active or has active children
    const isActive = item.id === activeView;
    const hasActiveChild = useMemo(() => {
        const check = (node: MenuItem): boolean => {
            if (node.id === activeView) return true;
            return node.children ? node.children.some(check) : false;
        };
        return item.children ? item.children.some(check) : false;
    }, [item, activeView]);

    // Construct class names
    const baseClasses = "flex items-center w-full p-3 transition-colors duration-200 outline-none";
    const activeClasses = isActive
        ? "bg-indigo-600/10 text-indigo-400 border-r-2 border-indigo-600"
        : hasActiveChild
            ? "text-slate-200"
            : "text-slate-400 hover:text-white hover:bg-slate-800";

    const paddingLeft = level * 12 + 12; // px

    const handleClick = () => {
        if (item.children) {
            setIsExpanded(!isExpanded);
        } else if (item.id) {
            onNavigate(item.id);
        }
    };

    // Auto-expand if active child is present (initial load or nav change)
    useMemo(() => {
        if (hasActiveChild) setIsExpanded(true);
    }, [hasActiveChild]);

    return (
        <div className="w-full">
            <button
                onClick={handleClick}
                className={`${baseClasses} ${activeClasses}`}
                style={{ paddingLeft: `${paddingLeft}px` }}
            >
                <item.icon size={20} className={`shrink-0 ${isActive ? 'text-indigo-400' : ''}`} />
                <span className="ml-3 font-medium text-sm truncate flex-1 text-left">{item.label}</span>
                {item.children && (
                    <span className="ml-2">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                )}
            </button>
            {item.children && isExpanded && (
                <div className="overflow-hidden transition-all duration-300">
                    {item.children.map((child, idx) => (
                        <MenuItemComponent
                            key={child.id || idx}
                            item={child}
                            activeView={activeView}
                            onNavigate={onNavigate}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const Sidebar = ({ activeView, onNavigate, className = '', clients = [], projects = [], currentUser }: SidebarProps) => {

    const menuStructure = useMemo<MenuItem[]>(() => {
        // 1. Dynamic Client Trees
        const clientTrees: MenuItem[] = clients.map(client => {
            // Find projects for this client
            const clientProjects = projects.filter(p => p.clientId === client.id);

            // Create menu items for each project
            const projectItems: MenuItem[] = clientProjects.map(project => ({
                label: project.name,
                icon: Folder,
                // isOpen: false, // State handled in component usually, but we can pass initial
                children: [
                    { id: `project_${project.id}_dashboard`, icon: LayoutDashboard, label: 'Relatório Operacional' },
                    { id: `project_${project.id}_gantt`, icon: Calendar, label: 'Relatório Tático-Gerencial' }
                ]
            }));

            return {
                label: client.name,
                icon: Building2,
                // isOpen: false,
                children: [
                    { id: `client_${client.id}_reports`, icon: PieChart, label: 'Relatório Estratégico (Portfólio)' },
                    { id: `client_${client.id}_my_projects`, icon: Settings, label: 'Gerenciar Projetos' },
                    ...projectItems
                ]
            };
        });

        // 2. Main Menu Structure
        return [
            {
                label: 'Clientes',
                id: 'clients_manage',
                icon: UserCircle,
                // isOpen: false,
            },
            ...clientTrees,
            { id: 'team', icon: Users, label: 'Equipe' },
        ];
    }, [clients, projects]);

    return (
        <aside className={`h-screen w-20 lg:w-64 bg-slate-900 text-white flex flex-col transition-all duration-300 flex-shrink-0 border-r border-slate-800 ${className}`}>
            {/* Logo */}
            <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800 bg-slate-950/50 shrink-0">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/20">A</div>
                <span className="ml-3 font-bold text-lg hidden lg:block tracking-tight text-white">Antigravity</span>
            </div>

            {/* User Info (Mini) */}
            {currentUser && (
                <div className="p-4 border-b border-slate-800 hidden lg:flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold border border-slate-600">
                        {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate text-slate-200">{currentUser.displayName}</p>
                        <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                <div className="space-y-1">
                    {menuStructure.map((item, index) => (
                        <MenuItemComponent
                            key={item.id || index}
                            item={item}
                            activeView={activeView}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/30 shrink-0">
                {currentUser?.role === 'master' && (
                    <button
                        onClick={() => onNavigate('settings')}
                        className="flex items-center text-slate-400 hover:text-white transition-colors w-full justify-center lg:justify-start group p-2 rounded-lg hover:bg-slate-800"
                    >
                        <Settings size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                        <span className="ml-3 hidden lg:block font-medium">Configurações</span>
                    </button>
                )}
                <div className="text-xs text-slate-600 text-center mt-2 hidden lg:block font-mono">
                    v{appVersion}
                </div>
            </div>
        </aside>
    );
};

export const MobileMenu = (props: SidebarProps & { isOpen: boolean; onClose: () => void }) => {
    const { isOpen, onClose, ...sidebarProps } = props;
    return (
        <>
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />
            <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 transform transition-transform duration-300 lg:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl border-r border-slate-700`}>
                <Sidebar
                    {...sidebarProps}
                    className="w-full h-full border-none"
                    onNavigate={(view) => {
                        sidebarProps.onNavigate(view);
                        onClose();
                    }}
                />
            </div>
        </>
    );
};
