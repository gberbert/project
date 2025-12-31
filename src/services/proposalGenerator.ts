
import PptxGenJS from 'pptxgenjs';
import { Project, RaciItem, ClientResponsibility, Task } from '../types';
import { getImage } from '../lib/slideStorage';
import { calculateBusinessDays } from '../lib/utils';

interface OverlayText {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    bold?: boolean;
    width?: number;
    height?: number;
}

interface SlideConfig {
    id: string;
    type: 'custom' | 'automatic';
    name: string;
    imageId?: string;
    overlays?: OverlayText[];
}

interface BrandingConfig {
    logoId?: string;
    logoWidth?: number;
    logoHeight?: number;
    logoX?: number;
    logoY?: number;
    titleX?: number;
    titleY?: number;
    lineX?: number;
    lineY?: number;
    lineWidth?: number;
    headerId?: string;
    footerId?: string;
}

interface TemplateConfig {
    slides: SlideConfig[];
    branding: BrandingConfig;
}

interface GenerationOptions {
    includeGantt?: boolean;
    ganttElementId?: string;
    tasks?: Task[];
    viewMode?: string;
    templateConfig?: TemplateConfig;
}

export const generateProposalPpt = async (project: Project, options: GenerationOptions = {}) => {
    const pptx = new PptxGenJS();

    // --- Layout Configuration ---
    pptx.layout = 'LAYOUT_16x9';

    // Define Colors (Sober Blue Theme)
    const COLOR_PRIMARY = '00204A'; // Navy Blue (Sober)
    const COLOR_SECONDARY = '0072BC'; // Brand Blue
    const COLOR_ACCENT = 'E6F0F9'; // Light Blue Background
    const COLOR_TEXT = '1F2937';

    // --- Load Branding Images ---
    let brandingImages: { logo?: string, header?: string, footer?: string } = {};
    let brandingDims: { logo?: { w: number, h: number } } = {};

    if (options.templateConfig?.branding) {
        console.log("Loading Branding Images for configuration:", options.templateConfig.branding);

        if (options.templateConfig.branding.logoId) {
            brandingImages.logo = await getImage(options.templateConfig.branding.logoId) || undefined;
            if (options.templateConfig.branding.logoWidth && options.templateConfig.branding.logoHeight) {
                brandingDims.logo = {
                    w: options.templateConfig.branding.logoWidth,
                    h: options.templateConfig.branding.logoHeight
                };
            }
            console.log("Logo Loaded:", !!brandingImages.logo, brandingDims.logo);
        }
        if (options.templateConfig.branding.headerId) {
            brandingImages.header = await getImage(options.templateConfig.branding.headerId) || undefined;
        }
        if (options.templateConfig.branding.footerId) {
            brandingImages.footer = await getImage(options.templateConfig.branding.footerId) || undefined;
        }
    }

    // --- Helper: Add Branded Slide ---
    const addBrandedSlide = (title?: string) => {
        const slide = pptx.addSlide();

        // Add Header Image
        if (brandingImages.header) {
            slide.addImage({ data: brandingImages.header, x: 0, y: 0, w: '100%', h: 1.0 }); // Approx height
        }

        // Add Footer Image
        if (brandingImages.footer) {
            // Slide H is usually 5.625 for 16x9 (10x5.625 inches)
            slide.addImage({ data: brandingImages.footer, x: 0, y: 5.625 - 0.8, w: '100%', h: 0.8 });
        }

        // Add Logo
        if (brandingImages.logo) {
            const w = brandingDims.logo?.w || 1.42;
            const h = brandingDims.logo?.h || 0.29;

            // Default Position Logic: Top Right
            let x = 10 - w - 0.18;
            let y = 0.15;

            // Override with configured values if present
            if (options.templateConfig?.branding?.logoX !== undefined) {
                x = options.templateConfig.branding.logoX;
            }
            if (options.templateConfig?.branding?.logoY !== undefined) {
                y = options.templateConfig.branding.logoY;
            }

            slide.addImage({ data: brandingImages.logo, x: x, y: y, w: w, h: h });
        }

        // Add Title if provided (Standardized)
        if (title) {
            // Defaults
            let tX = 0.5;
            let tY = 0.5;
            let lX = 0.5;
            let lY = 0.9;
            let lW = 9.0;

            if (options.templateConfig?.branding) {
                const b = options.templateConfig.branding;
                if (b.titleX !== undefined) tX = b.titleX;
                if (b.titleY !== undefined) tY = b.titleY;
                if (b.lineX !== undefined) lX = b.lineX;
                if (b.lineY !== undefined) lY = b.lineY;
                if (b.lineWidth !== undefined) lW = b.lineWidth;
            }

            // Ensure Title has ample width and fixed height to prevent collapsing
            const safeW = Math.max(4.0, 9.8 - tX);
            slide.addText(title, {
                x: tX, y: tY, w: safeW, h: 0.38,
                fontSize: 20, color: COLOR_PRIMARY, bold: true, align: 'left',
                isTextBox: true, autoFit: false
            });
            // Decorative line below title
            slide.addShape(pptx.ShapeType.line, {
                x: lX, y: lY, w: lW, h: 0, line: { color: COLOR_SECONDARY, width: 2 }
            });
        }

        return slide;
    };

    // --- Helper: Markdown Parser ---
    // Parses bold (**text**), headers (#), and handles line breaks/bullets
    const parseMarkdown = (text: string, fontSize: number): any[] => {
        const textObjects: any[] = [];
        const lines = text.split('\n');

        lines.forEach((line, lineIndex) => {
            const trimmed = line.trim();
            if (trimmed.length === 0) {
                // Empty line -> simple break
                if (lineIndex < lines.length - 1) {
                    textObjects.push({
                        text: '',
                        options: { breakLine: true, fontSize: fontSize, paraSpaceBefore: 0, paraSpaceAfter: 0 }
                    });
                }
                return;
            }

            // Check header or bullet
            let isBullet = false;
            let forceBold = false;
            let extraFontSize = 0;
            let content = line;

            if (trimmed.startsWith('#')) {
                const match = trimmed.match(/^(#+)\s+(.*)/);
                if (match) {
                    const level = match[1].length;
                    content = match[2] || '';
                    forceBold = true;
                    // H1=+6, H2=+4, H3+=+2
                    if (level === 1) extraFontSize = 6;
                    else if (level === 2) extraFontSize = 4;
                    else extraFontSize = 2;
                }
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                isBullet = true;
                content = trimmed.substring(2);
            }

            // Parse Bold: split by **
            const parts = content.split(/(\*\*.*?\*\*)/g);

            parts.forEach((part, partIndex) => {
                if (!part) return;

                let isBold = false;
                let textPart = part;

                if (part.startsWith('**') && part.endsWith('**')) {
                    isBold = true;
                    textPart = part.substring(2, part.length - 2);
                }

                const options: any = {
                    fontSize: fontSize + extraFontSize,
                    bold: isBold || forceBold,
                    paraSpaceBefore: 0,
                    paraSpaceAfter: 0
                };

                if (partIndex === parts.length - 1) {
                    options.breakLine = true;
                }

                if (isBullet && partIndex === 0) {
                    options.bullet = { code: '2022' };
                    options.indentLevel = 0;
                }

                textObjects.push({ text: textPart, options: options });
            });
        });

        return textObjects;
    };


    // --- Core Content Generators ---
    const generateProjectContent = () => {

        // --- 1. Cover Slide (REMOVED: User uses custom image slide) ---
        // const slideCover = addBrandedSlide(); // No title for cover
        // // slideCover.background = { color: COLOR_ACCENT }; // Use branding header/footer/bg if available, or keep accent

        // slideCover.addText("PROPOSTA TÉCNICA", {
        //     x: 0.5, y: 2, w: '90%', fontSize: 36, fontFace: 'Arial', color: COLOR_PRIMARY, bold: true
        // });

        // slideCover.addText(project.name, {
        //     x: 0.5, y: 3, w: '90%', fontSize: 24, fontFace: 'Arial', color: COLOR_SECONDARY
        // });

        // slideCover.addText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, {
        //     x: 0.5, y: 5, fontSize: 14, color: '666666'
        // });


        // --- Dynamic Documentation Slides ---
        if (project.documentation) {
            // Check if context is used in custom slides
            const contextUsedInCustomSlides = options.templateConfig?.slides.some(s =>
                s.type === 'custom' && s.overlays?.some(o => o.text.toLowerCase().includes('{contexto}'))
            );

            const DOC_ORDER = ['context_overview', 'technical_solution', 'implementation_steps', 'testing_strategy', 'scope', 'non_scope'];
            const existingKeys = Object.keys(project.documentation);
            const orderedKeys = DOC_ORDER.filter(key => existingKeys.includes(key));
            const otherKeys = existingKeys.filter(key => !DOC_ORDER.includes(key));
            const finalKeys = [...orderedKeys, ...otherKeys];
            const docs = project.documentation;

            finalKeys.forEach((key) => {
                const content = docs ? docs[key as keyof typeof docs] : undefined;
                if (!content || (content as string).trim().length === 0) return;

                // Skip Context Overview if used in custom slide
                if (key === 'context_overview' && contextUsedInCustomSlides) return;

                let title = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                const titleMap: Record<string, string> = {
                    'context_overview': 'Contexto Estratégico',
                    'technical_solution': 'Solução Técnica',
                    'implementation_steps': 'Estratégia de Implementação',
                    'testing_strategy': 'Plano de Testes',
                    'scope': 'Detalhamento de Escopo (Quantitativo)',
                    'non_scope': 'Não Escopo (Fora do Perímetro)'
                };
                if (titleMap[key]) title = titleMap[key];

                const slide = addBrandedSlide(title);

                const textOps = parseMarkdown(content, 10);

                if (key === 'context_overview') {
                    // Context Layout: Two Columns
                    slide.addText(textOps, {
                        x: 0.5, y: 1.2, w: '45%', h: 4, color: COLOR_TEXT, align: 'justify', valign: 'top',
                        paraSpaceBefore: 0, paraSpaceAfter: 0
                    });

                    // Placeholder for diagram
                    slide.addText("Espaço para Diagrama / Imagem", {
                        x: 5.5, y: 1.2, w: '40%', h: 3.5, fontSize: 14, color: 'AAAAAA', align: 'center',
                        shape: pptx.ShapeType.rect, fill: { color: 'FFFFFF' }, line: { color: 'DDDDDD', dashType: 'dash' }
                    });
                } else {
                    slide.addText(textOps, {
                        x: 0.5, y: 1.2, w: '90%', h: 4, color: COLOR_TEXT, valign: 'top',
                        paraSpaceBefore: 0, paraSpaceAfter: 0
                    });
                }
            });
        }

        // --- Technical Premises ---
        if (project.technicalPremises && project.technicalPremises.length > 0) {
            const slidePremises = addBrandedSlide("Premissas Técnicas e Restrições");
            const items = project.technicalPremises.map(p => ({
                text: p,
                options: { fontSize: 10, breakLine: true, bullet: { code: '2022' }, paraSpaceBefore: 0, paraSpaceAfter: 0 }
            }));
            slidePremises.addText(items, { x: 0.5, y: 1.2, w: '90%', color: COLOR_TEXT, valign: 'top' });
        }

        // --- RACI Matrix ---
        if (project.raciMatrix && project.raciMatrix.length > 0) {
            const slideRaci = addBrandedSlide("Matriz de Responsabilidades (RACI)");
            const tableData: any[][] = [[
                { text: "Atividade", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF' } },
                { text: "Responsável (R)", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF' } },
                { text: "Aprovador (A)", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF' } },
                { text: "Consultado (C)", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF' } },
                { text: "Informado (I)", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF' } }
            ]];
            project.raciMatrix.forEach(row => {
                tableData.push([
                    { text: row.activity_group, options: { fontSize: 10 } },
                    { text: row.responsible, options: { fontSize: 10 } },
                    { text: row.accountable, options: { fontSize: 10 } },
                    { text: row.consulted, options: { fontSize: 10 } },
                    { text: row.informed, options: { fontSize: 10 } }
                ]);
            });
            slideRaci.addTable(tableData, { x: 0.5, y: 1.2, w: 9, fontSize: 10, border: { pt: 1, color: 'DDDDDD' }, autoPage: true, rowH: 0.4 });
        }

        // --- Team Structure ---
        if (project.teamStructure && project.teamStructure.length > 0) {
            const slideTeam = addBrandedSlide("Estrutura de Equipe Sugerida");
            const tableData: any[][] = [[
                { text: "Papel / Especialista", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF' } },
                { text: "Qtd", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF', align: 'center' } },
                { text: "Responsabilidades Chave", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF' } }
            ]];
            project.teamStructure.forEach(member => {
                tableData.push([
                    { text: member.role, options: { fontSize: 10, bold: true, fill: 'F3F4F6', color: COLOR_PRIMARY } },
                    { text: member.quantity.toString(), options: { fontSize: 10, align: 'center' } },
                    { text: member.responsibilities.join(", "), options: { fontSize: 10 } }
                ]);
            });
            slideTeam.addTable(tableData, { x: 0.5, y: 1.2, w: 9, fontSize: 10, border: { pt: 1, color: 'DDDDDD' }, rowH: 0.5, autoPage: true });

            // Add concise resource cost note
            slideTeam.addText("Nota: A alocação considera dedicação variável conforme a fase do projeto. O dimensionamento final pode ser ajustado na etapa de contrato.", {
                x: 0.5, y: 5.2, w: 9, h: 0.3, fontSize: 9, color: '666666', italic: true
            });
        }

        // --- Client Responsibilities ---
        if (project.clientResponsibilities && project.clientResponsibilities.length > 0) {
            const slideResp = addBrandedSlide("Responsabilidades do Cliente");
            const tableData: any[][] = [[
                { text: "Ação Necessária", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF' } },
                { text: "Prazo / Marco", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF' } },
                { text: "Impacto no Projeto", options: { bold: true, fill: COLOR_SECONDARY, color: 'FFFFFF' } }
            ]];
            project.clientResponsibilities.forEach(row => {
                tableData.push([
                    { text: row.action_item, options: { fontSize: 10 } },
                    { text: row.deadline_description, options: { fontSize: 10 } },
                    { text: row.impact, options: { fontSize: 10, bold: true, color: row.impact === 'BLOCKER' ? 'DC2626' : '000000' } }
                ]);
            });
            slideResp.addTable(tableData, { x: 0.5, y: 1.2, w: 9, fontSize: 10, border: { pt: 1, color: 'DDDDDD' }, rowH: 0.5 });
        }

        // --- Native Roadmap ---
        if (options.tasks && options.tasks.length > 0) {
            const slideRoadmap = addBrandedSlide("Cronograma Macro (Editável)");

            // 1. Filter Phases
            const phases = options.tasks.filter(t => t.type === 'project' || !t.parent).sort((a, b) => (a.order || 0) - (b.order || 0));

            if (phases.length > 0) {
                const isWeekly = options.viewMode === 'Week';
                let minDate = new Date(phases[0].start);
                let maxDate = new Date(phases[0].end);

                phases.forEach(p => {
                    const s = new Date(p.start);
                    const e = new Date(p.end);
                    if (s < minDate) minDate = s;
                    if (e > maxDate) maxDate = e;
                });
                maxDate.setDate(maxDate.getDate() + 15);

                if (isWeekly) {
                    minDate.setDate(minDate.getDate() - minDate.getDay());
                } else {
                    minDate.setDate(1);
                }

                // Layout Constants
                const CHART_START_X = 0.5;
                const CHART_WIDTH = 9.2;
                const LABEL_WIDTH = 2.0;

                const HEADER_Y = 1.0;
                const HEADER_H = 0.69;
                const ROW_START_Y = HEADER_Y + HEADER_H + 0.1;
                const ROW_HEIGHT = 0.45;

                const pxPerDay = isWeekly
                    ? (0.16 / 7)
                    : (0.21 / 30);

                const PALETTE = ['0072BC', '003B5C', '4B9CD3', '2C5282', '1A365D', '5198D6']; // Sober Blue

                // Add Total Project Duration Label (Top Left Corner)
                const totalBizDays = calculateBusinessDays(minDate, maxDate);
                const totalBizHours = totalBizDays * 8;
                slideRoadmap.addText(`Total Estimado:\n${totalBizDays} dias úteis / ${totalBizHours}h`, {
                    x: CHART_START_X, y: HEADER_Y, w: LABEL_WIDTH, h: HEADER_H,
                    fontSize: 10, color: '1F2937', bold: true, align: 'center', valign: 'middle',
                    fill: { color: 'F3F4F6' }, line: { color: 'FFFFFF', width: 1 }
                });

                // Draw Timeline Header...
                let currTime = new Date(minDate);
                let colIndex = 0;

                while (true) {
                    const nextTime = new Date(currTime);
                    if (isWeekly) nextTime.setDate(nextTime.getDate() + 7);
                    else nextTime.setMonth(nextTime.getMonth() + 1);

                    const timeDiff = Math.max(0, currTime.getTime() - minDate.getTime());
                    const daysDiff = timeDiff / (1000 * 3600 * 24);
                    const labelX = CHART_START_X + LABEL_WIDTH + (daysDiff * pxPerDay);

                    if (labelX > CHART_START_X + CHART_WIDTH - 0.05) break;

                    const daysInSegment = (nextTime.getTime() - currTime.getTime()) / (1000 * 3600 * 24);
                    const segW = daysInSegment * pxPerDay;

                    const headerColors = ['D0E1F2', 'B4D5E6', 'E1EFF9', 'C8DEEF']; // Sober Blue Header
                    const bgCol = headerColors[colIndex % headerColors.length];

                    slideRoadmap.addShape(pptx.ShapeType.rect, {
                        x: labelX, y: HEADER_Y, w: segW, h: HEADER_H,
                        fill: { color: bgCol }, line: { color: 'FFFFFF', width: 1 }
                    });

                    let labelText = isWeekly
                        ? currTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                        : `${currTime.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '')}/${currTime.toLocaleDateString('pt-BR', { year: '2-digit' })}`;

                    slideRoadmap.addText(labelText, {
                        x: labelX + (segW / 2) - (0.69 / 2), y: HEADER_Y + (HEADER_H / 2) - (0.21 / 2),
                        w: 0.69, h: 0.21, fontSize: 9, color: '374151',
                        rotate: 270, align: 'center', valign: 'middle'
                    });

                    slideRoadmap.addShape(pptx.ShapeType.line, {
                        x: labelX, y: ROW_START_Y, w: 0, h: (phases.length * ROW_HEIGHT) + 0.1,
                        line: { color: 'E5E7EB', width: 1 }
                    });

                    currTime = nextTime;
                    colIndex++;
                }

                // Draw Phases
                phases.forEach((phase, index) => {
                    const yPos = ROW_START_Y + (index * ROW_HEIGHT);
                    const color = PALETTE[index % PALETTE.length];

                    if (index % 2 === 0) {
                        slideRoadmap.addShape(pptx.ShapeType.rect, {
                            x: CHART_START_X, y: yPos, w: CHART_WIDTH, h: ROW_HEIGHT,
                            fill: { color: 'F9FAFB' }
                        });
                    }

                    // Number & Name
                    const num = (index + 1).toString();
                    slideRoadmap.addShape(pptx.ShapeType.ellipse, {
                        x: CHART_START_X + 0.05, y: yPos + 0.05, w: 0.30, h: 0.30,
                        fill: { color: color }
                    });
                    slideRoadmap.addText(num, {
                        x: CHART_START_X + 0.05, y: yPos + 0.05, w: 0.30, h: 0.30,
                        fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle'
                    });

                    slideRoadmap.addText(phase.name, {
                        x: CHART_START_X + 0.4, y: yPos, w: LABEL_WIDTH - 0.45, h: ROW_HEIGHT,
                        fontSize: 10, bold: true, color: '374151', valign: 'middle'
                    });

                    // Bar
                    let start = new Date(phase.start);
                    let end = new Date(phase.end);
                    if (start < minDate) start = minDate;
                    if (end > maxDate) end = maxDate;

                    const daysStart = (start.getTime() - minDate.getTime()) / (1000 * 3600 * 24);
                    const daysDuration = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);

                    const barX = CHART_START_X + LABEL_WIDTH + (daysStart * pxPerDay);
                    let barW = daysDuration * pxPerDay;
                    if (barW < 0.1) barW = 0.1;

                    slideRoadmap.addShape(pptx.ShapeType.rect, {
                        x: barX, y: yPos + (ROW_HEIGHT / 2) - 0.08, w: barW, h: 0.16,
                        fill: { color: color }
                    });

                    // Add Business Days/Hours Label above bar
                    const businessDays = calculateBusinessDays(start, end);
                    const hours = businessDays * 8;
                    const durationText = `${businessDays} dias / ${hours}h`;

                    slideRoadmap.addText(durationText, {
                        x: barX, y: yPos - 0.05, w: Math.max(1.5, barW), h: 0.20,
                        fontSize: 8, color: '6B7280', align: 'left', bold: true
                    });

                    // Start/End Circles
                    if (start >= minDate) {
                        // Hollow at start
                        slideRoadmap.addShape(pptx.ShapeType.ellipse, {
                            x: barX - 0.08, y: yPos + (ROW_HEIGHT / 2) - 0.08, w: 0.16, h: 0.16,
                            line: { color: color, width: 2 }, fill: { color: 'FFFFFF' }
                        });
                    }
                    if (end <= maxDate) {
                        // Solid at end
                        slideRoadmap.addShape(pptx.ShapeType.ellipse, {
                            x: barX + barW - 0.08, y: yPos + (ROW_HEIGHT / 2) - 0.08, w: 0.16, h: 0.16,
                            fill: { color: color }
                        });
                    }
                });

                // --- Billing Proposal Section ---
                const BILLING_START_Y = ROW_START_Y + (phases.length * ROW_HEIGHT) + 0.4;

                slideRoadmap.addText("Proposta de Faturamento (Marcos de Entrega)", {
                    x: CHART_START_X, y: BILLING_START_Y, w: 5.0, h: 0.3,
                    fontSize: 12, bold: true, color: '003B5C'
                });

                // Table Header
                const T_Y = BILLING_START_Y + 0.35;
                slideRoadmap.addShape(pptx.ShapeType.rect, { x: CHART_START_X, y: T_Y, w: 4.8, h: 0.25, fill: { color: 'E5E7EB' } });
                slideRoadmap.addText("Marco", { x: CHART_START_X + 0.1, y: T_Y, w: 2.3, h: 0.25, fontSize: 8, bold: true, color: '374151' });
                slideRoadmap.addText("Data Estimada", { x: CHART_START_X + 2.4, y: T_Y, w: 1.5, h: 0.25, fontSize: 8, bold: true, color: '374151' });
                slideRoadmap.addText("% Fat.", { x: CHART_START_X + 3.9, y: T_Y, w: 0.9, h: 0.25, fontSize: 8, bold: true, color: '374151', align: 'center' });

                // Table Rows
                let currentY = T_Y + 0.25;

                // Distribuição de Faturamento Sob Medida (10/25/45/20) para 4 fases
                let shares: number[] = [];
                if (phases.length === 4) {
                    shares = [10, 25, 45, 20];
                } else {
                    // Fallback: Equal share
                    const baseShare = Math.floor(100 / phases.length);
                    shares = Array(phases.length).fill(baseShare);
                    // Adjust last one to sum to 100
                    const sum = shares.reduce((a, b) => a + b, 0);
                    if (sum < 100) shares[shares.length - 1] += (100 - sum);
                }

                phases.forEach((phase, i) => {
                    let pEnd = new Date(phase.end);
                    const dateStr = pEnd.toLocaleDateString('pt-BR');
                    const percent = shares[i] || 0;

                    slideRoadmap.addShape(pptx.ShapeType.line, { x: CHART_START_X, y: currentY + 0.25, w: 4.8, h: 0, line: { color: 'D1D5DB' } });

                    slideRoadmap.addText(`${i + 1}. ${phase.name}`, {
                        x: CHART_START_X + 0.1, y: currentY, w: 2.3, h: 0.25, fontSize: 8, color: '4B5563'
                    });
                    slideRoadmap.addText(dateStr, {
                        x: CHART_START_X + 2.4, y: currentY, w: 1.5, h: 0.25, fontSize: 8, color: '4B5563'
                    });
                    slideRoadmap.addText(`${percent}%`, {
                        x: CHART_START_X + 3.9, y: currentY, w: 0.9, h: 0.25, fontSize: 8, color: '4B5563', align: 'center'
                    });

                    currentY += 0.25;
                });

                // --- Disclaimer Text (Bottom Right) ---
                const DISCLAIMER_X = CHART_START_X + 5.2;
                const DISCLAIMER_W = CHART_WIDTH - 5.2;

                slideRoadmap.addText("Considerações do Planejamento:", {
                    x: DISCLAIMER_X, y: BILLING_START_Y, w: DISCLAIMER_W, h: 0.3,
                    fontSize: 12, bold: true, color: '003B5C'
                });

                const disclaimerText = "Este cronograma macro apresenta uma visão executiva e não exaustiva das atividades previstas. As datas e durações são estimativas preliminares que poderão sofrer ajustes conforme o aprofundamento técnico realizado na fase de 'Planejamento e Análise'.\n\nA validação final deste plano dependerá do detalhamento dos requisitos e da confirmação de premissas junto à equipe do cliente, garantindo a conformidade com os objetivos de negócio.";

                slideRoadmap.addText(disclaimerText, {
                    x: DISCLAIMER_X, y: T_Y, w: DISCLAIMER_W, h: 1.5,
                    fontSize: 8, color: '4B5563', align: 'justify', valign: 'top'
                });
            }
        }
    };


    // --- MAIN EXECUTION FLOW ---

    console.log("Starting PPT Generation with options:", options);

    // Fallback if no template is provided
    const slidesList = options.templateConfig?.slides || [{ id: 'auto', type: 'automatic', name: 'Standard' }];
    console.log("Slides to generate:", slidesList);

    for (const slideItem of slidesList) {
        console.log(`Processing slide: ${slideItem.name} (${slideItem.type})`);

        if (slideItem.type === 'custom' && slideItem.imageId) {
            console.log(`Attempting to retrieve image: ${slideItem.imageId}`);
            try {
                const bgImage = await getImage(slideItem.imageId);
                if (bgImage) {
                    console.log("Image retrieved successfully. Adding slide.");
                    const s = pptx.addSlide();
                    s.background = { data: bgImage };

                    // Add Overlays
                    if (slideItem.overlays && slideItem.overlays.length > 0) {
                        try {
                            // Use 'any' cast to bypass strict check for quick fix, or check if clientName exists
                            const clientName = (project as any).clientName || 'Cliente';
                            const projectName = project.name || 'Projeto';
                            const dateStr = new Date().toLocaleDateString('pt-BR');
                            const contextContent = project.documentation?.['context_overview'] || "";

                            slideItem.overlays.forEach(ol => {
                                let text = ol.text || "";
                                text = text.replace(/{cliente}/gi, clientName);
                                text = text.replace(/{projeto}/gi, projectName);
                                text = text.replace(/{data}/gi, dateStr);
                                text = text.replace(/{contexto}/gi, contextContent);

                                const textItems = parseMarkdown(text, ol.fontSize);

                                s.addText(textItems, {
                                    x: ol.x, y: ol.y,
                                    w: ol.width && ol.width > 0 ? ol.width : undefined,
                                    h: ol.height && ol.height > 0 ? ol.height : undefined,
                                    color: ol.color,
                                    fontFace: 'Arial',
                                    wrap: !!(ol.width && ol.width > 0)
                                });
                            });
                        } catch (overlayErr) {
                            console.error("Error adding overlays:", overlayErr);
                        }
                    }
                } else {
                    console.error(`Image not found in DB for key: ${slideItem.imageId}`);
                    const s = pptx.addSlide();
                    s.addText(`AVISO: Imagem não encontrada (ID: ${slideItem.imageId})`, { x: 0.5, y: 0.5, fontSize: 14, color: 'FF0000' });
                }
            } catch (err) {
                console.error("Error retrieving image from DB:", err);
                const s = pptx.addSlide();
                s.addText(`ERRO: Falha ao carregar imagem`, { x: 0.5, y: 0.5, fontSize: 14, color: 'FF0000' });
            }
        } else if (slideItem.type === 'automatic') {
            console.log("Generating automatic project content...");
            generateProjectContent();
        }
    }

    console.log("Writing file...");
    // Save
    pptx.writeFile({ fileName: `Proposta_${project.name}.pptx` });
};
