import { useState } from 'react';
import { Resource } from '../types';
import { ProjectService } from '../services/projectService';
import { Trash2, Plus, User, DollarSign, Briefcase } from 'lucide-react';

interface TeamModalProps {
    resources: Resource[];
    onClose: () => void;
    isConnected: boolean;
}

export const TeamModal = ({ resources, onClose, isConnected }: TeamModalProps) => {
    const [newResource, setNewResource] = useState({ name: '', role: '', hourlyRate: 0 });
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isConnected) {
            alert("Connect to Firebase to manage team members.");
            return;
        }
        if (newResource.name) {
            try {
                await ProjectService.addResource(newResource);
                setNewResource({ name: '', role: '', hourlyRate: 0 });
                setIsAdding(false);
            } catch (error) {
                console.error("Error adding resource:", error);
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (!isConnected) return;
        if (confirm('Delete this team member? Tasks assigned to them will remain but lose the assignment link.')) {
            await ProjectService.deleteResource(id);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Team Management</h2>
                        <p className="text-sm text-gray-500">Add or remove project members and set their rates.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        ✕
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* List */}
                    <div className="space-y-3 mb-6">
                        {resources.map(res => (
                            <div key={res.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                        {res.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800">{res.name}</h4>
                                        <p className="text-xs text-gray-500 flex items-center gap-2">
                                            <span>{res.role}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span className="text-green-600 font-medium">R$ {res.hourlyRate}/h</span>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(res.id)}
                                    className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Remove Member"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}

                        {resources.length === 0 && (
                            <div className="text-center py-8 text-gray-400">
                                No team members found. Add someone to start tracking costs!
                            </div>
                        )}
                    </div>

                    {/* Add Form */}
                    {isAdding ? (
                        <form onSubmit={handleAdd} className="bg-gray-50 p-4 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="font-bold text-gray-700 mb-3 text-sm">New Team Member</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Name"
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        value={newResource.name}
                                        onChange={e => setNewResource({ ...newResource, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Role (e.g. Designer)"
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-indigo-500"
                                        value={newResource.role}
                                        onChange={e => setNewResource({ ...newResource, role: e.target.value })}
                                    />
                                </div>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 text-gray-400" size={16} />
                                    <input
                                        type="number"
                                        placeholder="Rate/Hour"
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-indigo-500"
                                        value={newResource.hourlyRate}
                                        onChange={e => setNewResource({ ...newResource, hourlyRate: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow-sm"
                                >
                                    Save Member
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setIsAdding(true)}
                            disabled={!isConnected}
                            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus size={20} />
                            {isConnected ? "Add New Member" : "Connect DB to Add Members"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
