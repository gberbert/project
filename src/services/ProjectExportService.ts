import { Project, Task } from '../types';

const escapeXml = (unsafe: string) => {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

const formatMSPDate = (date: Date | string | undefined) => {
    if (!date) return formatMSPDate(new Date());
    const d = new Date(date);
    if (isNaN(d.getTime())) return new Date().toISOString().split('.')[0];

    // Use Local Time to match what user sees in UI
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    // Force start at 08:00:00 to ensure it falls within standard working day
    // Prevents timezone shifts pushing it to previous/next day
    return `${year}-${month}-${day}T08:00:00`;
};

export const exportProjectToXML = (project: Project, tasks: Task[]) => {
    if (!tasks || tasks.length === 0) {
        alert("O projeto não possui tarefas para exportar.");
        return;
    }

    // 1. Sort tasks by visual order (ProjectService ensures 'order' property)
    const sortedTasks = [...tasks].sort((a, b) => (a.order || 0) - (b.order || 0));

    // 2. Map IDs to Integers (1..N) for MS Project UIDs
    const idMap = new Map<string, number>();
    sortedTasks.forEach((t, i) => idMap.set(t.id, i + 1));

    // 3. Calculate Outline Levels (Hierarchy)
    const outlineLevelMap = new Map<string, number>();

    sortedTasks.forEach(task => {
        let level = 1;
        if (task.parent && outlineLevelMap.has(task.parent)) {
            level = outlineLevelMap.get(task.parent)! + 1;
        }
        outlineLevelMap.set(task.id, level);
    });

    // 3a. Calculate actual Project Start from tasks
    let minTaskStart = project.startDate;
    if (sortedTasks.length > 0) {
        const starts = sortedTasks.map(t => new Date(t.start).getTime()).filter(t => !isNaN(t));
        if (starts.length > 0) {
            minTaskStart = new Date(Math.min(...starts));
        }
    }

    // 4. Build XML String
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<Project xmlns="http://schemas.microsoft.com/project">\n';
    xml += `  <Name>${escapeXml(project.name)}</Name>\n`;
    xml += `  <Title>${escapeXml(project.name)}</Title>\n`;
    xml += `  <CreationDate>${formatMSPDate(new Date())}</CreationDate>\n`;
    xml += `  <LastSaved>${formatMSPDate(new Date())}</LastSaved>\n`;
    xml += `  <ScheduleFromStart>1</ScheduleFromStart>\n`;
    xml += `  <StartDate>${formatMSPDate(minTaskStart)}</StartDate>\n`;
    xml += `  <FinishDate>${formatMSPDate(project.endDate)}</FinishDate>\n`;

    xml += '  <Tasks>\n';

    sortedTasks.forEach(task => {
        const uid = idMap.get(task.id);
        const level = outlineLevelMap.get(task.id);
        const isSummary = sortedTasks.some(t => t.parent === task.id);
        const hasDependencies = task.dependencies && task.dependencies.length > 0;

        xml += '    <Task>\n';
        xml += `      <UID>${uid}</UID>\n`;
        xml += `      <ID>${uid}</ID>\n`;
        xml += `      <Name>${escapeXml(task.name)}</Name>\n`;
        xml += `      <Active>${task.isDisabled ? 0 : 1}</Active>\n`;
        const calculateDuration = (start: Date | string, end: Date | string) => {
            const d1 = new Date(start);
            const d2 = new Date(end);
            if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 'PT8H0M0S'; // Default 1 day

            // Clone to avoid modifying dates
            const startDate = new Date(d1);
            const endDate = new Date(d2);

            // Reset hours to start of day for accurate day diff
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);

            let count = 0;
            const curDate = new Date(startDate.getTime());

            // Inclusive count of weekdays
            while (curDate <= endDate) {
                const dayOfWeek = curDate.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sun (0) or Sat (6)
                    count++;
                }
                curDate.setDate(curDate.getDate() + 1);
            }

            // If start == end, it's 1 day (unless milestone logic handled elsewhere, but assuming 1 day task)
            // Adjust logic: if end > start, count covers range.
            if (count === 0 && d1.getTime() < d2.getTime()) count = 1; // At least 1 if range exists but was weekend?

            return `PT${count * 8}H0M0S`; // 8 hours per day
        };

        // ... inside loop ...
        // Auto Schedule
        xml += `      <Manual>0</Manual>\n`;
        xml += `      <OutlineLevel>${level}</OutlineLevel>\n`;
        xml += `      <Start>${formatMSPDate(task.start)}</Start>\n`;
        xml += `      <Finish>${formatMSPDate(task.end)}</Finish>\n`;
        xml += `      <Duration>${calculateDuration(task.start, task.end)}</Duration>\n`;
        xml += `      <PercentComplete>${task.progress || 0}</PercentComplete>\n`;

        // ONLY constrain tasks that have NO dependencies and are NOT summary tasks
        // This allows tasks with dependencies to flow naturally based on logic
        if (!hasDependencies && !isSummary) {
            xml += `      <ConstraintType>4</ConstraintType>\n`; // Start No Earlier Than
            xml += `      <ConstraintDate>${formatMSPDate(task.start)}</ConstraintDate>\n`;
        }

        xml += `      <Summary>${isSummary ? 1 : 0}</Summary>\n`;

        // Dependencies (Predecessors)
        if (hasDependencies) {
            task.dependencies!.forEach(depId => {
                const depUid = idMap.get(depId);
                if (depUid) {
                    xml += '      <PredecessorLink>\n';
                    xml += `        <PredecessorUID>${depUid}</PredecessorUID>\n`;
                    xml += `        <Type>1</Type>\n`; // Finish-to-Start
                    xml += '      </PredecessorLink>\n';
                }
            });
        }

        xml += '    </Task>\n';
    });

    xml += '  </Tasks>\n';
    xml += '</Project>';

    // 5. Trigger Download
    try {
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Download failed", e);
        alert("Erro ao gerar download do arquivo XML.");
    }
};
