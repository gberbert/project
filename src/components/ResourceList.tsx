import { Resource } from '../types';

interface ResourceListProps {
    resources: Resource[];
}

export const ResourceList = ({ resources }: ResourceListProps) => {
    return (
        <aside className="w-64 bg-white border-l border-gray-200 p-4 h-full overflow-y-auto hidden lg:block">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Team</h3>
            <div className="space-y-4">
                {resources.map((resource) => (
                    <div key={resource.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                            {resource.avatarUrl ? (
                                <img src={resource.avatarUrl} alt={resource.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                resource.name.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{resource.name}</p>
                            <p className="text-xs text-gray-500 truncate">{resource.role}</p>
                            <p className="text-xs font-semibold text-green-600">R$ {resource.hourlyRate.toFixed(2)}/h</p>
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );
};
