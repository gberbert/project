import { useState, useMemo, useEffect } from 'react';
import { LayoutDashboard, Calendar, Users, Settings, PieChart, ChevronDown, ChevronRight, Folder, Building2, UserCircle } from 'lucide-react';
import { appVersion } from '../version';
import { Client } from '../types/client';

interface MenuItem {
    id?: string;
    label: string;
    icon: any;
    children?: MenuItem[];
    isOpen?: boolean;
    isDynamic?: boolean;
}

import { Project } from '../types';

interface MenuItem {
    id?: string;
    label: string;
    icon: any;
    children?: MenuItem[];
    isOpen?: boolean;
    isDynamic?: boolean;
}

interface SidebarProps {
    activeView: string;
    onNavigate: (view: string) => void;
    className?: string;
    clients?: Client[];
    projects?: Project[];
}

const MenuItemComponent = ({ item, depth = 0, activeView, onNavigate }: { item: MenuItem, depth?: number, activeView: string, onNavigate: (view: string) => void }) => {
    // Open if active or if child is active
    const isChildActive = item.children?.some(child => child.id === activeView || child.children?.some(c => c.id === activeView));
    const [isOpen, setIsOpen] = useState(item.isOpen || isChildActive || false);

    useEffect(() => {
        if (isChildActive) setIsOpen(true);
    }, [isChildActive]);

    const hasChildren = item.children && item.children.length > 0;
    const isActive = item.id === activeView;

    const handleClick = () => {
        if (hasChildren) {
            setIsOpen(!isOpen);
        } else if (item.id) {
            onNavigate(item.id);
        }
    };

    const paddingLeft = depth * 12 + 16;

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

export const Sidebar = ({ activeView, onNavigate, className = '', clients = [], projects = [] }: SidebarProps) => {

    const menuStructure = useMemo<MenuItem[]>(() => {
        // 1. Dynamic Client Trees
        const clientTrees: MenuItem[] = clients.map(client => {
            // Find projects for this client
            const clientProjects = projects.filter(p => p.clientId === client.id);

            // Create menu items for each project
            const projectItems: MenuItem[] = clientProjects.map(project => ({
                label: project.name,
                icon: Folder,
                isOpen: false,
                children: [
                    { id: `project_${project.id}_dashboard`, icon: LayoutDashboard, label: 'Relatório Operacional' },
                    { id: `project_${project.id}_gantt`, icon: Calendar, label: 'Relatório Tático-Gerencial' }
                ]
            }));

            return {
                label: client.name,
                icon: Building2,
                isOpen: false,
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
                isOpen: false
            },
            ...clientTrees,
            { id: 'team', icon: Users, label: 'Equipe' },
        ];
    }, [clients, projects]);

    return (
        <aside className={`h-screen w-20 lg:w-64 bg-slate-900 text-white flex flex-col transition-all duration-300 flex-shrink-0 border-r border-slate-800 ${className}`}>
            <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800 bg-slate-950/50">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/20">P</div>
                <span className="ml-3 font-bold text-lg hidden lg:block tracking-tight text-white">Projetos</span>
            </div>

            <nav className="flex-1 py-6 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                <div className="space-y-1">
                    {menuStructure.map((item, index) => (
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
        </aside>
    );
};

export const MobileMenu = ({ isOpen, onClose, activeView, onNavigate, clients }: SidebarProps & { isOpen: boolean; onClose: () => void }) => {
    return (
        <>
            <div
                className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />
            <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar activeView={activeView} onNavigate={(view) => { onNavigate(view); onClose(); }} className="w-full h-full" clients={clients} />
            </div>
        </>
    );
};
