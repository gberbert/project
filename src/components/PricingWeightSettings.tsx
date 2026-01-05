
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Save, RotateCcw, Image as ImageIcon, X, Edit2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

// --- Types ---
type Complexity = 'PP' | 'P' | 'M' | 'G' | 'GG';
type Uncertainty = 'PP' | 'P' | 'M' | 'G' | 'GG';

interface ComponentServiceUnit {
    id: string;
    name: string;
    technology: string;
    hours: number;
}

interface PricingConfig {
    matrix: Record<string, number>; // Key format: "COMPLEXITY-UNCERTAINTY"
    components: ComponentServiceUnit[];
}

const COMPLEXITIES: Complexity[] = ['GG', 'G', 'M', 'P', 'PP']; // Rows
const UNCERTAINTIES: Uncertainty[] = ['PP', 'P', 'M', 'G', 'GG']; // Cols

const DEFAULT_MATRIX: Record<string, number> = {
    // GG Row
    'GG-PP': 5, 'GG-P': 6, 'GG-M': 7, 'GG-G': 8, 'GG-GG': 9,
    // G Row
    'G-PP': 4, 'G-P': 5, 'G-M': 6, 'G-G': 7, 'G-GG': 8,
    // M Row
    'M-PP': 3, 'M-P': 4, 'M-M': 5, 'M-G': 6, 'M-GG': 7,
    // P Row
    'P-PP': 2, 'P-P': 3, 'P-M': 4, 'P-G': 5, 'P-GG': 6,
    // PP Row
    'PP-PP': 1, 'PP-P': 2, 'PP-M': 3, 'PP-G': 4, 'PP-GG': 5,
};

const DEFAULT_COMPONENTS: ComponentServiceUnit[] = [
    // --- Java (Spring Boot / Jakarta EE) ---
    { id: 'java-1', name: 'Microservice Setup', technology: 'Java', hours: 16 },
    { id: 'java-2', name: 'REST Controller (CRUD)', technology: 'Java', hours: 8 },
    { id: 'java-3', name: 'Service Layer Logic', technology: 'Java', hours: 12 },
    { id: 'java-4', name: 'JPA/Hibernate Entity & Repository', technology: 'Java', hours: 6 },
    { id: 'java-5', name: 'DTO Mapping', technology: 'Java', hours: 4 },
    { id: 'java-6', name: 'Security Configuration (JWT/OAuth)', technology: 'Java', hours: 16 },
    { id: 'java-7', name: 'Unit Testing (JUnit/Mockito)', technology: 'Java', hours: 8 },
    { id: 'java-8', name: 'Batch Job (Spring Batch)', technology: 'Java', hours: 24 },
    { id: 'java-9', name: 'Exception Handler (Global)', technology: 'Java', hours: 6 },
    { id: 'java-10', name: 'Integration with 3rd Party API', technology: 'Java', hours: 12 },
    { id: 'java-11', name: 'Thymeleaf / JSP View (SSR)', technology: 'Java', hours: 8 },
    { id: 'java-12', name: 'JSF / PrimeFaces Page', technology: 'Java', hours: 12 },
    { id: 'java-13', name: 'EJB / Message Driven Bean', technology: 'Java', hours: 10 },

    // --- Node.js ---
    { id: 'node-1', name: 'Express/Fastify Server Setup', technology: 'Node.js', hours: 8 },
    { id: 'node-2', name: 'API Route Handler', technology: 'Node.js', hours: 6 },
    { id: 'node-3', name: 'Middleware (Auth/Logging)', technology: 'Node.js', hours: 8 },
    { id: 'node-4', name: 'Database Schema (Mongoose/Prisma)', technology: 'Node.js', hours: 6 },
    { id: 'node-5', name: 'Authentication Logic', technology: 'Node.js', hours: 12 },
    { id: 'node-6', name: 'WebSocket / Real-time Handler', technology: 'Node.js', hours: 16 },
    { id: 'node-7', name: 'Background Worker (Bull/Agenda)', technology: 'Node.js', hours: 12 },
    { id: 'node-8', name: 'File Upload Service', technology: 'Node.js', hours: 8 },
    { id: 'node-9', name: 'Utility/Helper Functions', technology: 'Node.js', hours: 4 },
    { id: 'node-10', name: 'Unit Tests (Jest)', technology: 'Node.js', hours: 8 },
    { id: 'node-11', name: 'SSR View (EJS / Pug / Handlebars)', technology: 'Node.js', hours: 8 },
    { id: 'node-12', name: 'Serverless Function (AWS Lambda/Vercel)', technology: 'Node.js', hours: 6 },

    // --- Python (FastAPI / Django / Flask) ---
    { id: 'py-1', name: 'API Endpoint Function', technology: 'Python', hours: 6 },
    { id: 'py-2', name: 'Pydantic Model / Marshmallow Schema', technology: 'Python', hours: 4 },
    { id: 'py-3', name: 'Celery Task (Async)', technology: 'Python', hours: 12 },
    { id: 'py-4', name: 'Data Processing Script (Pandas/Polars)', technology: 'Python', hours: 16 },
    { id: 'py-5', name: 'Auth & Dependency Injection', technology: 'Python', hours: 8 },
    { id: 'py-6', name: 'Scraper / Crawler Bot', technology: 'Python', hours: 12 },
    { id: 'py-7', name: 'FastAPI Router Setup', technology: 'Python', hours: 4 },
    { id: 'py-8', name: 'OpenCV / Image Processing Module', technology: 'Python', hours: 20 },
    { id: 'py-9', name: 'Database Migration (Alembic)', technology: 'Python', hours: 6 },
    { id: 'py-10', name: 'PyTest Suite', technology: 'Python', hours: 8 },
    { id: 'py-11', name: 'Django Template / Jinja2 View', technology: 'Python', hours: 8 },
    { id: 'py-12', name: 'Streamlit / Dash App Page', technology: 'Python', hours: 10 },
    { id: 'py-13', name: 'AI Model Inference Pipeline', technology: 'Python', hours: 24 },

    // --- React (Web) ---
    { id: 'react-1', name: 'Page/View Container', technology: 'React', hours: 8 },
    { id: 'react-2', name: 'Reusable UI Component (Atom)', technology: 'React', hours: 6 },
    { id: 'react-3', name: 'Complex Widget / Dashboard', technology: 'React', hours: 24 },
    { id: 'react-4', name: 'Custom Hook', technology: 'React', hours: 4 },
    { id: 'react-5', name: 'Context Provider / State Slice', technology: 'React', hours: 8 },
    { id: 'react-6', name: 'Form with Validation (Hook Form)', technology: 'React', hours: 12 },
    { id: 'react-7', name: 'Data Fetching Hook (SWR/TanStack)', technology: 'React', hours: 6 },
    { id: 'react-8', name: 'Layout / Navigation Setup', technology: 'React', hours: 12 },
    { id: 'react-9', name: 'Modal / Popup Manager', technology: 'React', hours: 6 },
    { id: 'react-10', name: 'Integration Tests (React Testing Lib)', technology: 'React', hours: 12 },
    { id: 'react-11', name: 'Redux Store / Slice Setup', technology: 'React', hours: 8 },
    { id: 'react-12', name: 'Next.js Server Component (RSC)', technology: 'React', hours: 8 },

    // --- React Native ---
    { id: 'rn-1', name: 'Screen Container', technology: 'React Native', hours: 10 },
    { id: 'rn-2', name: 'Custom Native Module (Bridge)', technology: 'React Native', hours: 24 },
    { id: 'rn-3', name: 'Navigation Setup (React Navigation)', technology: 'React Native', hours: 12 },
    { id: 'rn-4', name: 'List View (FlatList optimized)', technology: 'React Native', hours: 8 },
    { id: 'rn-5', name: 'Platform Specific Style/Logic', technology: 'React Native', hours: 6 },
    { id: 'rn-6', name: 'Camera / Media Logic', technology: 'React Native', hours: 16 },
    { id: 'rn-7', name: 'Push Notification Handler', technology: 'React Native', hours: 12 },
    { id: 'rn-8', name: 'Offline Storage (MMKV/Realm)', technology: 'React Native', hours: 8 },
    { id: 'rn-9', name: 'Authentication Flow (Mobile)', technology: 'React Native', hours: 12 },
    { id: 'rn-10', name: 'Deep Linking Setup', technology: 'React Native', hours: 8 },
    { id: 'rn-11', name: 'Expo Config / Permission Handler', technology: 'React Native', hours: 6 },
    { id: 'rn-12', name: 'OTA Update Config (CodePush)', technology: 'React Native', hours: 8 },

    // --- Android Nativo (Kotlin) ---
    { id: 'android-1', name: 'Activity / Fragment Layout', technology: 'Android', hours: 10 },
    { id: 'android-2', name: 'ViewModel & LiveData/Flow', technology: 'Android', hours: 8 },
    { id: 'android-3', name: 'RecyclerView Adapter', technology: 'Android', hours: 6 },
    { id: 'android-4', name: 'Room Database Entity/DAO', technology: 'Android', hours: 8 },
    { id: 'android-5', name: 'Retrofit API Service', technology: 'Android', hours: 6 },
    { id: 'android-6', name: 'Custom View Component', technology: 'Android', hours: 16 },
    { id: 'android-7', name: 'Background Service / Worker', technology: 'Android', hours: 16 },
    { id: 'android-8', name: 'Dependency Injection (Hilt/Koin)', technology: 'Android', hours: 8 },
    { id: 'android-9', name: 'Gradle Build / Flavor Config', technology: 'Android', hours: 6 },
    { id: 'android-10', name: 'Jetpack Compose Screen', technology: 'Android', hours: 12 },
    { id: 'android-11', name: 'BroadcastReceiver / Intent Filter', technology: 'Android', hours: 6 },

    // --- iOS Nativo (Swift) ---
    { id: 'ios-1', name: 'ViewController / SwiftUI View', technology: 'iOS', hours: 10 },
    { id: 'ios-2', name: 'ViewModel (MVVM)', technology: 'iOS', hours: 8 },
    { id: 'ios-3', name: 'CoreData / SwiftData Model', technology: 'iOS', hours: 10 },
    { id: 'ios-4', name: 'Network Manager (Combine/Async)', technology: 'iOS', hours: 10 },
    { id: 'ios-5', name: 'Custom Table/Collection Cell', technology: 'iOS', hours: 6 },
    { id: 'ios-6', name: 'SwiftUI Animation/Transition', technology: 'iOS', hours: 8 },
    { id: 'ios-7', name: 'App Delegate / Scene Config', technology: 'iOS', hours: 4 },
    { id: 'ios-8', name: 'Coordinator Pattern', technology: 'iOS', hours: 12 },
    { id: 'ios-9', name: 'StoreKit Integration (IAP)', technology: 'iOS', hours: 16 },
    { id: 'ios-10', name: 'Local Notification Manager', technology: 'iOS', hours: 8 },
    { id: 'ios-11', name: 'Widget Extension', technology: 'iOS', hours: 16 },

    // --- .NET (C#) ---
    { id: 'net-1', name: 'ASP.NET Core Controller', technology: '.NET', hours: 8 },
    { id: 'net-2', name: 'Entity Framework Model/Context', technology: '.NET', hours: 8 },
    { id: 'net-3', name: 'Business Service Layer', technology: '.NET', hours: 10 },
    { id: 'net-4', name: 'LINQ Query / Repository Method', technology: '.NET', hours: 6 },
    { id: 'net-5', name: 'Dependency Injection Config', technology: '.NET', hours: 4 },
    { id: 'net-6', name: 'SignalR Hub (Real-time)', technology: '.NET', hours: 12 },
    { id: 'net-7', name: 'Background Hosted Service', technology: '.NET', hours: 12 },
    { id: 'net-8', name: 'Identity / Auth Setup', technology: '.NET', hours: 16 },
    { id: 'net-9', name: 'Blazor Component', technology: '.NET', hours: 10 },
    { id: 'net-10', name: 'NUnit / XUnit Test Class', technology: '.NET', hours: 8 },
    { id: 'net-11', name: 'ASP.NET MVC View (Razor)', technology: '.NET', hours: 8 },
    { id: 'net-12', name: 'Razor Page (.cshtml)', technology: '.NET', hours: 8 },
    { id: 'net-13', name: 'WPF Window / UserControl (XAML)', technology: '.NET', hours: 12 },
    { id: 'net-14', name: 'MAUI / Xamarin Page', technology: '.NET', hours: 12 },
    { id: 'net-15', name: 'Azure Function (Serverless)', technology: '.NET', hours: 6 },
    { id: 'net-16', name: 'Minimal API Endpoint', technology: '.NET', hours: 4 },
];

export const PricingWeightSettings = () => {
    // State
    const [matrix, setMatrix] = useState<Record<string, number>>(DEFAULT_MATRIX);
    const [components, setComponents] = useState<ComponentServiceUnit[]>(DEFAULT_COMPONENTS);
    const [search, setSearch] = useState('');

    // New Component State (will be used in modal)
    const [newCompName, setNewCompName] = useState('');
    const [newCompTech, setNewCompTech] = useState('');
    const [newCompHours, setNewCompHours] = useState<number>(0);

    // Image State
    const [exampleImage, setExampleImage] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null); // Stores ID of component being edited

    // Modal State
    const [showModal, setShowModal] = useState(false);

    const { getRootProps: getImageProps, getInputProps: getImageInput } = useDropzone({
        onDrop: (acceptedFiles) => {
            const file = acceptedFiles[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    setExampleImage(base64);
                    localStorage.setItem('PRICING_EXAMPLE_IMG', base64);
                };
                reader.readAsDataURL(file);
            }
        },
        accept: { 'image/*': [] },
        maxFiles: 1
    });

    useEffect(() => {
        const storedImg = localStorage.getItem('PRICING_EXAMPLE_IMG');
        if (storedImg) setExampleImage(storedImg);
    }, []);

    const handleMatrixChange = (comp: Complexity, unc: Uncertainty, val: number) => {
        setMatrix(prev => ({
            ...prev,
            [`${comp}-${unc}`]: val
        }));
    };

    const handleNewComponentClick = () => {
        setEditingId(null); // Ensure we're in "add" mode
        setNewCompName('');
        setNewCompTech('');
        setNewCompHours(0);
        setShowModal(true);
    };

    const handleComponentClick = (comp: ComponentServiceUnit) => {
        setNewCompName(comp.name);
        setNewCompTech(comp.technology);
        setNewCompHours(comp.hours);
        setEditingId(comp.id);
        setShowModal(true); // Open modal for editing
    };

    const handleAddOrUpdateComponent = () => {
        if (!newCompName || !newCompTech || newCompHours <= 0) return;

        if (editingId) {
            // Update
            setComponents(prev => prev.map(c => c.id === editingId ? { ...c, name: newCompName, technology: newCompTech, hours: newCompHours } : c));
            setEditingId(null);
        } else {
            // Add
            const newComp: ComponentServiceUnit = {
                id: Date.now().toString(),
                name: newCompName,
                technology: newCompTech,
                hours: newCompHours
            };
            setComponents([...components, newComp]);
        }

        setNewCompName('');
        setNewCompHours(0);
        setEditingId(null);
    };

    const handleCancelEdit = () => {
        setNewCompName('');
        setNewCompHours(0);
        setEditingId(null);
    };

    const handleDeleteComponent = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering edit
        setComponents(prev => prev.filter(c => c.id !== id));
        if (editingId === id) handleCancelEdit();
    };

    // Grouping
    const filteredComponents = components.filter(c =>
        c.technology.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    const groupedComponents = filteredComponents.reduce((acc, curr) => {
        if (!acc[curr.technology]) acc[curr.technology] = [];
        acc[curr.technology].push(curr);
        return acc;
    }, {} as Record<string, ComponentServiceUnit[]>);

    return (
        <div className="h-full flex flex-col md:flex-row gap-6 p-6 overflow-hidden">
            {/* Left Column: Matrix & Image */}
            <div className="w-full md:w-1/2 flex flex-col gap-6 overflow-y-auto pr-2">

                {/* Matrix Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden shrink-0">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">Matriz: Complexidade x Incerteza</h3>
                        <button
                            onClick={() => setMatrix(DEFAULT_MATRIX)}
                            className="text-xs text-gray-500 hover:text-indigo-600 flex items-center gap-1"
                        >
                            <RotateCcw size={12} /> Resetar
                        </button>
                    </div>

                    <div className="p-4">
                        <div className="relative">
                            {/* Header Row (Uncertainty) */}
                            <div className="flex mb-1">
                                <div className="w-16"></div> {/* Empty corner */}
                                <div className="flex-1 grid grid-cols-5 text-center font-bold text-xs text-gray-600 bg-gray-100 rounded-t py-1">
                                    {UNCERTAINTIES.map(u => (
                                        <div key={u} className={`${u === 'PP' ? 'bg-blue-100' : u === 'P' ? 'bg-blue-200' : u === 'M' ? 'bg-blue-300' : u === 'G' ? 'bg-blue-600 text-white' : 'bg-blue-800 text-white'} py-1 px-1 mx-0.5 rounded-sm`}>
                                            {u}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Rows */}
                            {COMPLEXITIES.map((comp) => (
                                <div key={comp} className="flex items-center mb-1">
                                    {/* Row Label (Complexity) */}
                                    <div className={`w-16 h-8 flex items-center justify-center font-bold text-xs rounded-l mr-1 ${comp === 'GG' ? 'bg-orange-700 text-white' :
                                        comp === 'G' ? 'bg-orange-500 text-white' :
                                            comp === 'M' ? 'bg-orange-300 text-gray-800' :
                                                comp === 'P' ? 'bg-orange-200 text-gray-800' :
                                                    'bg-orange-100 text-gray-800'
                                        }`}>
                                        {comp}
                                    </div>

                                    {/* Inputs */}
                                    <div className="flex-1 grid grid-cols-5 gap-1">
                                        {UNCERTAINTIES.map((unc) => (
                                            <input
                                                key={`${comp}-${unc}`}
                                                type="number"
                                                value={matrix[`${comp}-${unc}`] || 0}
                                                onChange={(e) => handleMatrixChange(comp, unc, parseFloat(e.target.value))}
                                                className="w-full h-8 text-center text-sm border rounded bg-white hover:border-indigo-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none transition-all"
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <div className="text-center text-[10px] text-gray-400 mt-2">
                                * Valores representam pontos de peso.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Example Image Upload */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden shrink-0 min-h-[250px] flex flex-col">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <ImageIcon size={16} className="text-gray-500" /> Exemplo de Referência
                        </h3>
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                        <div
                            {...getImageProps()}
                            className={`flex-1 min-h-[150px] border-2 border-dashed rounded-lg flex items-center justify-center flex-col gap-2 cursor-pointer transition-colors ${exampleImage ? 'border-indigo-200 bg-gray-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
                            style={{
                                backgroundImage: exampleImage ? `url(${exampleImage})` : 'none',
                                backgroundSize: 'contain',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center'
                            }}
                        >
                            <input {...getImageInput()} />
                            {!exampleImage && (
                                <>
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                                        <Plus size={24} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-700">Clique ou arraste uma imagem</p>
                                        <p className="text-xs text-gray-400">Referência visual para estimativa</p>
                                    </div>
                                </>
                            )}
                        </div>
                        {exampleImage && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setExampleImage(null); localStorage.removeItem('PRICING_EXAMPLE_IMG'); }}
                                className="mt-2 text-xs text-red-500 hover:text-red-700 self-center"
                            >
                                Remover Imagem
                            </button>
                        )}
                    </div>
                </div>

            </div>

            {/* Right Column: Components List */}
            <div className="w-full md:w-1/2 flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-gray-800">Unidades de Serviço por Objeto</h3>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleNewComponentClick}
                            className="flex items-center gap-1 px-3 py-1 bg-white border border-indigo-200 text-indigo-600 rounded-md text-xs font-bold hover:bg-indigo-50 hover:border-indigo-300 transition-colors shadow-sm"
                        >
                            <Plus size={12} /> Novo
                        </button>
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8 pr-2 py-1 text-xs border rounded-full focus:outline-none focus:border-indigo-500 w-32 md:w-40"
                            />
                        </div>
                    </div>
                </div>

                {/* List Content - Expanded Height */}
                <div className="flex-1 overflow-y-auto p-4 min-h-[400px]">
                    {Object.keys(groupedComponents).length === 0 ? (
                        <div className="text-center text-gray-400 py-10">Nenhum componente encontrado.</div>
                    ) : (
                        Object.entries(groupedComponents).map(([tech, comps]) => (
                            <div key={tech} className="mb-4">
                                <h4 className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block mb-2 uppercase tracking-wide">
                                    {tech}
                                </h4>
                                <div className="space-y-1">
                                    {comps.map(comp => (
                                        <div
                                            key={comp.id}
                                            className="flex items-center justify-between text-sm p-2 rounded border border-transparent hover:bg-gray-50 hover:border-gray-100 transition-all"
                                        >
                                            <span className="font-medium text-gray-700 truncate mr-2" onClick={() => handleComponentClick(comp)}>{comp.name}</span>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded text-xs mr-2">{comp.hours}h</span>
                                                <button
                                                    onClick={() => handleComponentClick(comp)}
                                                    className="text-gray-400 hover:text-indigo-600 p-1 rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteComponent(comp.id, e)}
                                                    className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Component Modal */}
                {showModal && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800 text-lg">
                                    {editingId ? 'Editar Componente' : 'Novo Componente'}
                                </h3>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do Objeto</label>
                                    <input
                                        type="text"
                                        value={newCompName}
                                        onChange={(e) => setNewCompName(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                                        placeholder="Ex: Login Screen"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tecnologia</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            list="tech-list-modal"
                                            value={newCompTech}
                                            onChange={(e) => setNewCompTech(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                                            placeholder="Ex: React"
                                        />
                                        <datalist id="tech-list-modal">
                                            {Object.keys(groupedComponents).map(t => <option key={t} value={t} />)}
                                        </datalist>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Horas Estimadas</label>
                                    <input
                                        type="number"
                                        value={newCompHours || ''}
                                        onChange={(e) => setNewCompHours(parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm"
                                        placeholder="0"
                                    />
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => { handleAddOrUpdateComponent(); setShowModal(false); }}
                                        disabled={!newCompName || !newCompTech || newCompHours <= 0}
                                        className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {editingId ? 'Salvar' : 'Criar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
