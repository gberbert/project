import { Task, TaskType } from '../types';

export const parseProjectXML = async (file: File): Promise<Task[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                let xmlText = e.target?.result as string;
                if (!xmlText) throw new Error("Arquivo vazio");

                // Strip XML Namespaces
                xmlText = xmlText.replace(/xmlns="[^"]*"/g, "");
                xmlText = xmlText.replace(/xmlns:[a-zA-Z0-9]+="[^"]*"/g, "");

                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");

                const parseErrors = xmlDoc.getElementsByTagName("parsererror");
                if (parseErrors.length > 0) {
                    throw new Error("Erro de Parse XML: " + parseErrors[0].textContent);
                }

                const xmlTasks = xmlDoc.getElementsByTagName('Task');
                const tasks: Task[] = [];
                const uidMap = new Map<string, string>();
                const xmlNodeMap = new Map<string, Element>();

                // Pass 1: Create Tasks
                for (let i = 0; i < xmlTasks.length; i++) {
                    const el = xmlTasks[i];
                    const getVal = (tag: string) => el.getElementsByTagName(tag)[0]?.textContent || '';

                    const uid = getVal('UID');
                    const activeVal = getVal('Active');
                    const isActive = activeVal !== '0';
                    const name = getVal('Name') || 'Sem Nome';

                    if (!uid || !isActive) continue;

                    const newId = crypto.randomUUID();
                    uidMap.set(uid, newId);
                    xmlNodeMap.set(uid, el);

                    let start = new Date(getVal('Start'));
                    let end = new Date(getVal('Finish'));

                    if (isNaN(start.getTime())) start = new Date();
                    if (isNaN(end.getTime())) end = new Date();

                    tasks.push({
                        id: newId,
                        order: i, // VITAL: Maintain XML order for visual hierarchy (Gantt sorts by this field)
                        name,
                        start,
                        end,
                        type: getVal('Summary') === '1' ? 'project' : 'task',
                        progress: parseInt(getVal('PercentComplete') || '0'),
                        dependencies: [],
                        parent: null,
                        isExpanded: true,
                        isDisabled: false,
                        // @ts-ignore
                        _xmlLevel: parseInt(getVal('OutlineLevel') || '0'),
                        // @ts-ignore
                        _xmlUid: uid,
                        styles: {
                            backgroundColor: '#6366f1',
                            progressColor: '#4338ca',
                            backgroundSelectedColor: '#818cf8'
                        }
                    });
                }

                if (tasks.length === 0) {
                    throw new Error("Nenhuma tarefa válida encontrada no arquivo.");
                }

                // Pass 2: Hierarchy & Dependencies
                const parentStack: { id: string, level: number }[] = [];

                for (const task of tasks) {
                    // @ts-ignore
                    const level = task._xmlLevel;
                    // @ts-ignore
                    const uid = task._xmlUid;

                    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= level) {
                        parentStack.pop();
                    }
                    if (parentStack.length > 0) {
                        task.parent = parentStack[parentStack.length - 1].id;
                    }
                    parentStack.push({ id: task.id, level });

                    const el = xmlNodeMap.get(uid);
                    if (el) {
                        const preds = el.getElementsByTagName('PredecessorLink');
                        for (let j = 0; j < preds.length; j++) {
                            const pUid = preds[j].getElementsByTagName('PredecessorUID')[0]?.textContent;
                            if (pUid && uidMap.has(pUid)) {
                                task.dependencies.push(uidMap.get(pUid)!);
                            }
                        }
                    }

                    // @ts-ignore
                    delete task._xmlLevel;
                    // @ts-ignore
                    delete task._xmlUid;
                }

                resolve(tasks);

            } catch (err: any) {
                console.error("XML Import Exception:", err);
                reject(err);
            }
        };
        reader.onerror = () => {
            reject(new Error("Erro ao ler o arquivo."));
        };
        reader.readAsText(file);
    });
};
