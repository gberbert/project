
import PptxGenJS from 'pptxgenjs';
import { Project, RaciItem, ClientResponsibility, Task } from '../types';
import { getImage } from '../lib/slideStorage';
import { calculateBusinessDays } from '../lib/utils';
import { geminiService } from './geminiService';

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
    smartDesign?: boolean;
    onStatusUpdate?: (status: string) => void;
}

export const generateProposalPpt = async (project: Project, options: GenerationOptions = {}) => {
    const pptx = new PptxGenJS();

    // --- Layout Configuration ---
    pptx.layout = 'LAYOUT_16x9';

    // Define Colors (Modern Tech Theme)
    const COLOR_PRIMARY = '111827'; // Dark Gray/Black (Inter-like)
    const COLOR_SECONDARY = '4F46E5'; // Indigo 600 (Vibrant)
    const COLOR_ACCENT = 'EEF2FF'; // Indigo 50 (Very light)
    const COLOR_TEXT = '374151'; // Gray 700

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

    // --- Helper: Add Branded Slide (Modern) ---
    const addBrandedSlide = (title?: string) => {
        const slide = pptx.addSlide();

        // Default Font
        slide.color = COLOR_TEXT;

        // Add Header Image
        if (brandingImages.header) {
            slide.addImage({ data: brandingImages.header, x: 0, y: 0, w: '100%', h: 1.0 });
        } else {
            // Modern Geometric Accent if no header
            slide.addShape(pptx.ShapeType.rect, { x: 9.0, y: 0, w: 1.0, h: 0.15, fill: { color: COLOR_SECONDARY } });
            slide.addShape(pptx.ShapeType.rect, { x: 9.4, y: 0, w: 0.6, h: 0.3, fill: { color: COLOR_SECONDARY, transparency: 50 } });
        }

        // Add Footer Image
        if (brandingImages.footer) {
            slide.addImage({ data: brandingImages.footer, x: 0, y: 5.625 - 0.8, w: '100%', h: 0.8 });
        } else {
            // Minimal Footer Page Number
            slide.addText('CONFIDENCIAL', { x: 0.5, y: 5.2, fontSize: 8, color: '9CA3AF' });
        }

        // Add Logo
        if (brandingImages.logo) {
            const w = brandingDims.logo?.w || 1.42;
            const h = brandingDims.logo?.h || 0.29;
            // Default Position Logic: Top Right
            let x = 10 - w - 0.3;
            let y = 0.25;

            if (options.templateConfig?.branding?.logoX !== undefined) x = options.templateConfig.branding.logoX;
            if (options.templateConfig?.branding?.logoY !== undefined) y = options.templateConfig.branding.logoY;

            slide.addImage({ data: brandingImages.logo, x: x, y: y, w: w, h: h });
        }

        // Add Title if provided (Modern Style)
        if (title) {
            // Defaults
            let tX = 0.6; // Slightly more right to allow bar
            let tY = 0.45;

            if (options.templateConfig?.branding) {
                const b = options.templateConfig.branding;
                if (b.titleX !== undefined) tX = b.titleX;
                if (b.titleY !== undefined) tY = b.titleY;
            }

            // 1. Accent Bar (Vertical)
            slide.addShape(pptx.ShapeType.rect, {
                x: tX - 0.2, y: tY + 0.05, w: 0.08, h: 0.35,
                fill: { color: COLOR_SECONDARY }
            });

            // 2. Title Text
            slide.addText(title, {
                x: tX, y: tY, w: 8.0, h: 0.5,
                fontSize: 24, color: COLOR_PRIMARY, bold: true, align: 'left', fontFace: 'Segoe UI',
                isTextBox: true, autoFit: false
            });
        }

        return slide;
    };

    // --- Helper: Markdown Parser (Styled) ---
    const parseMarkdown = (text: string, fontSize: number): any[] => {
        const textObjects: any[] = [];
        const lines = text.split('\n');

        lines.forEach((line, lineIndex) => {
            const trimmed = line.trim();
            if (trimmed.length === 0) {
                if (lineIndex < lines.length - 1) {
                    textObjects.push({
                        text: '',
                        options: { breakLine: true, fontSize: fontSize * 0.5 } // Smaller gap
                    });
                }
                return;
            }

            let isBullet = false;
            let forceBold = false;
            let extraFontSize = 0;
            let content = line;
            let textColor = COLOR_TEXT;

            if (trimmed.startsWith('#')) {
                const match = trimmed.match(/^(#+)\s+(.*)/);
                if (match) {
                    const level = match[1].length;
                    content = match[2] || '';
                    forceBold = true;
                    if (level === 1) { extraFontSize = 4; textColor = COLOR_SECONDARY; } // H1 Indigo
                    else if (level === 2) { extraFontSize = 2; textColor = COLOR_PRIMARY; } // H2 Dark
                    else { forceBold = true; } // H3 Bold
                }
            } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                // Check if it's likely a bullet (starts with - or * followed by space or is just the char)
                // Use regex to strip the bullet char and ANY leading whitespace from the remainder
                const bulletMatch = trimmed.match(/^[-*]\s*(.*)/);
                if (bulletMatch) {
                    isBullet = true;
                    content = bulletMatch[1].trim(); // Strictly trim the content
                }
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
    const generateProjectContent = async () => {

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
        if (!project.documentation && options.smartDesign) {
            options.onStatusUpdate?.("AVISO: Documentação ausente. Ignorando slides inteligentes.");
        }

        if (project.documentation) {
            console.log("Docs found:", Object.keys(project.documentation));
            console.log("Smart Design Enabled:", options.smartDesign);

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

            for (const key of finalKeys) {
                console.log(`Processing Auto Slide: ${key}`);

                // --- EXCLUDE BUDGET (Moved to Custom Template Tag) ---
                if (key === 'budget') continue;

                const content = docs ? docs[key as keyof typeof docs] : undefined;
                if (!content || (content as string).trim().length === 0) continue;

                // Skip Context Overview if used in custom slide
                if (key === 'context_overview' && contextUsedInCustomSlides) continue;

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

                if (options.smartDesign) {
                    try {
                        const statusMsg = `Agente de Layout (IA): ${title}`;
                        options.onStatusUpdate?.(statusMsg);

                        // 2. Optimize Content
                        const constraintDesc = key === 'context_overview' ? 'context' : 'standard';
                        const optimizedText = await geminiService.optimizeContentForSlide(content as string, constraintDesc);

                        // Call the Autonomous Agent to Plan the Distribution with SPECIFIC CONTENT TYPE KEY
                        const slidePlan = await geminiService.distributeContentAcrossSlides(
                            optimizedText,
                            key
                        );

                        // Execute the Plan
                        slidePlan.forEach((planItem, idx) => {
                            const slideTitle = idx === 0 ? title : `${title} ${planItem.title_suffix}`;
                            const slide = addBrandedSlide(slideTitle);

                            // --- NEW: DUAL COLUMN + SUMMARY LAYOUT ---
                            if (planItem.summary && planItem.left_column && planItem.right_column) {
                                // 1. Summary
                                slide.addText(planItem.summary, {
                                    x: 0.5, y: 1.0, w: '90%', h: 0.8,
                                    fontSize: 14, color: COLOR_TEXT, bold: true,
                                    valign: 'top', align: 'left',
                                    fill: { color: 'F5F5F5' },
                                    paraSpaceBefore: 0, paraSpaceAfter: 0
                                });

                                // 2. Render Left Column (IMG3)
                                const leftOps = parseMarkdown(planItem.left_column, planItem.font_size || 10);
                                slide.addText(leftOps, {
                                    x: 0.5, y: 2.0, w: 4.3, h: 3.5,
                                    color: COLOR_TEXT, valign: 'top', align: 'justify',
                                    paraSpaceBefore: 0, paraSpaceAfter: 0
                                });

                                // 3. Render Right Column (IMG4)
                                const rightOps = parseMarkdown(planItem.right_column, planItem.font_size || 10);
                                slide.addText(rightOps, {
                                    x: 5.1, y: 2.0, w: 4.3, h: 3.5,
                                    color: COLOR_TEXT, valign: 'top', align: 'justify',
                                    paraSpaceBefore: 0, paraSpaceAfter: 0
                                });

                            }
                            // --- LEGACY/STANDARD LAYOUTS ---
                            else {
                                const textOps = parseMarkdown(planItem.content || "", planItem.font_size || 11);

                                if (key === 'context_overview') {
                                    slide.addText(textOps, {
                                        x: 0.5, y: 1.2, w: '45%', h: 4, color: COLOR_TEXT, align: 'justify', valign: 'top',
                                        paraSpaceBefore: 0, paraSpaceAfter: 0
                                    });

                                    if (idx === 0) {
                                        slide.addText("Espaço para Diagrama / Imagem", {
                                            x: 5.5, y: 1.2, w: '40%', h: 3.5, fontSize: 14, color: 'AAAAAA', align: 'center',
                                            shape: pptx.ShapeType.rect, fill: { color: 'FFFFFF' }, line: { color: 'DDDDDD', dashType: 'dash' }
                                        });
                                    }
                                } else {
                                    slide.addText(textOps, {
                                        x: 0.5, y: 1.2, w: '90%', h: 4, color: COLOR_TEXT, valign: 'top',
                                        paraSpaceBefore: 0, paraSpaceAfter: 0
                                    });
                                }
                            }
                        });


                        // --- ARCHITECTURE DIAGRAM INJECTION (Post Technical Solution) ---
                        if (key === 'technical_solution') {
                            options.onStatusUpdate?.("Gerando Arquitetura de Solução (IA Image)...");
                            try {
                                const archContext = content as string;
                                // 1. Get Prompt
                                const archPrompt = await geminiService.generateArchitecturePrompt(archContext);
                                console.log("Architecture Prompt Generated:", archPrompt);

                                // 2. Generate Image
                                const archImageBase64 = await geminiService.generateImage(archPrompt);

                                // 3. Generate Explanatory Text (Summary)
                                const archSummaryPrompt = `
                                    Analise a seguinte solução técnica e gere um resumo explicativo conciso para acompanhar o diagrama de arquitetura.
                                    Foque nos 3 ou 4 pilares principais da tecnologia escolhida.
                                    Use bullet points curtos.
                                    Limite total: 600 caracteres.
                                    
                                    Contexto:
                                    ${archContext}
                                `;

                                // We reuse optimizeContent logic or model direct call. 
                                // To be safe and quick, let's use the model directly via a helper or just reuse optimizeContent with a custom constraint.
                                // Actually, let's just use optimizeContentForSlide with a "very_short" constraint if possible, but the prompt is hardcoded there.
                                // Let's simplify: We'll modify optimize logic or just create a new prompt here.
                                // Since I can't easily change the service method signature without viewing it, I will use `optimizeContentForSlide` with a "context" constraint which generates a shorter summary, OR I will just call the global model if I had access.

                                // Better approach: Modify the `generateArchitecturePrompt` to ALSO return a summary? No, separation of concerns.
                                // Let's assume `geminiService` calls are cheap. I'll use `optimizeContentForSlide` passing a custom constraint string that I know the prompt will interpret, or just rely on 'context' type which is narrow.

                                const explainText = await geminiService.optimizeContentForSlide(archContext, "Summarize as 3-5 bullet points for a sidebar text box next to a diagram. Max 500 chars.");

                                // 4. Add Slide
                                const archSlide = addBrandedSlide("Arquitetura da Solução");

                                // Image on Right (as per previous code, x=3.5)
                                archSlide.addImage({
                                    data: archImageBase64,
                                    x: 3.5, y: 1.2, w: 6.0, h: 3.37
                                });

                                // Explanatory Text on Left (The "indicated position")
                                // Dimensions: H 8.72cm (~3.43in), W 7.14cm (~2.81in)
                                // Pos: x=0.5, y=1.2
                                const archTextOps = parseMarkdown(explainText, 10);
                                archSlide.addText(archTextOps, {
                                    x: 0.5, y: 1.2, w: 2.8, h: 3.4,
                                    fontSize: 10, color: COLOR_TEXT, align: 'left', valign: 'top',
                                    paraSpaceBefore: 5 // small gap between bullets
                                });

                                // Add prompt note smaller at bottom
                                archSlide.addText(`Prompt IA: ${archPrompt.substring(0, 100)}...`, {
                                    x: 0.5, y: 5.4, w: 9, h: 0.2, fontSize: 8, color: '999999'
                                });

                            } catch (archErr: any) {
                                console.error("Architecture Gen Failed", archErr);
                                const errSlide = addBrandedSlide("Arquitetura da Solução");
                                errSlide.addText(`Não foi possível gerar a imagem de arquitetura.\nErro: ${archErr.message}`, {
                                    x: 0.5, y: 2.0, w: 9, fontSize: 12, color: 'FF0000', align: 'center'
                                });
                            }
                        }

                        // Success! Continue to next item.
                        continue;

                    } catch (err: any) {
                        console.error(`Smart Slide verification failed for ${title}, using raw content.`, err);
                        const errorMsg = err?.message || "Erro desconhecido";
                        options.onStatusUpdate?.(`Aviso IA: ${errorMsg}. Usando texto original...`);

                        await new Promise(resolve => setTimeout(resolve, 1500));
                        // Fallback proceeds below
                    }
                }

                const slide = addBrandedSlide(title);

                const textOps = parseMarkdown(content, 10);

                if (key === 'context_overview') {
                    // Context Layout: Two Columns
                    slide.addText(textOps, {
                        x: 0.5, y: 1.2, w: '45%', h: 4, color: COLOR_TEXT, align: 'justify', valign: 'top',
                        paraSpaceBefore: 0, paraSpaceAfter: 0
                    });

                    // --- AI IMAGE GENERATION FOR CONTEXT ---
                    if (options.smartDesign) {
                        try {
                            const contextPrompt = `
                                Create a conceptual, professional corporate illustration for a presentation slide about:
                                "${(content as string).substring(0, 500)}"
                                
                                Style: Modern Tech, Minimalist, Isometric or Abstract Vector. 
                                Color Palette: Indigo/Blue/White. Clean white background.
                                NO TEXT inside the image.
                            `;

                            const contextImageBase64 = await geminiService.generateImage(contextPrompt);

                            slide.addImage({
                                data: contextImageBase64,
                                x: 5.5, y: 1.2, w: 4.0, h: 3.5
                            });
                        } catch (ctxErr) {
                            console.error("Context Image Generation Failed", ctxErr);
                            // Fallback to placeholder if gen fails
                            slide.addText("Espaço para Diagrama / Imagem", {
                                x: 5.5, y: 1.2, w: '40%', h: 3.5, fontSize: 14, color: 'AAAAAA', align: 'center',
                                shape: pptx.ShapeType.rect, fill: { color: 'FFFFFF' }, line: { color: 'DDDDDD', dashType: 'dash' }
                            });
                        }
                    } else {
                        // Placeholder for diagram (Legacy/No-Smart mode)
                        slide.addText("Espaço para Diagrama / Imagem (IA Desativada)", {
                            x: 5.5, y: 1.2, w: '40%', h: 3.5, fontSize: 14, color: 'AAAAAA', align: 'center',
                            shape: pptx.ShapeType.rect, fill: { color: 'FFFFFF' }, line: { color: 'DDDDDD', dashType: 'dash' }
                        });
                    }
                } else {
                    slide.addText(textOps, {
                        x: 0.5, y: 1.2, w: '90%', h: 4, color: COLOR_TEXT, valign: 'top',
                        paraSpaceBefore: 0, paraSpaceAfter: 0
                    });
                }
            }
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
            slideRaci.addTable(tableData, { x: 0.5, y: 1.2, w: 9, colW: [4.0, 1.25, 1.25, 1.25, 1.25], fontSize: 10, border: { pt: 1, color: 'DDDDDD' }, autoPage: true, rowH: 0.4 });
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
            // Optimized Layout: Wider (9.5), Tighter Columns, lower Y starting point if needed
            // User wants max usage. Slide width is 10. 
            // x=0.25, w=9.5 leaves 0.25 margin on sides.
            slideTeam.addTable(tableData, {
                x: 0.25, y: 1.1, w: 9.5,
                colW: [3.0, 0.8, 5.7], // More space for responsibilities
                fontSize: 10,
                border: { pt: 1, color: 'E5E7EB' },
                rowH: 0.35, // Tighter rows
                autoPage: true,
                autoPageCharWeight: 0.1, // Adjust if needed
                autoPageLineWeight: 0.5
            });

            // Add concise resource cost note - Lower position
            slideTeam.addText("Nota: A alocação considera dedicação variável conforme a fase do projeto. O dimensionamento final pode ser ajustado na etapa de contrato.", {
                x: 0.5, y: 5.3, w: 9, h: 0.3, fontSize: 8, color: '9CA3AF', italic: true
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
                // --- Native Roadmap (Replaced by AI Generation) ---
                const isWeekly = options.viewMode === 'Week';
                // Filter phases to exclude Management for the slide
                const visiblePhases = phases.filter(p => !p.id.includes('phase-mgmt'));

                const minTime = Math.min(...visiblePhases.map(p => new Date(p.start).getTime()));
                const maxTime = Math.max(...visiblePhases.map(p => new Date(p.end).getTime()));
                const minDate = new Date(minTime);
                const maxDate = new Date(maxTime);

                const totalDays = visiblePhases.reduce((acc, p) => acc + calculateBusinessDays(new Date(p.start), new Date(p.end)), 0);
                const totalHours = totalDays * 8;

                // --- AI IMAGE GENERATION FOR ROADMAP (Includes Billing) ---
                options.onStatusUpdate?.("Gerando Visualização de Cronograma (IA Image)...");

                try {
                    // 1. Calculate Billing Milestones (Logic extracted from removed table)
                    let shares: number[] = [];
                    if (phases.length === 4) {
                        shares = [10, 25, 45, 20];
                    } else {
                        const baseShare = Math.floor(100 / phases.length);
                        shares = Array(phases.length).fill(baseShare);
                        const sum = shares.reduce((a, b) => a + b, 0);
                        if (sum < 100) shares[shares.length - 1] += (100 - sum);
                    }

                    // 2. Construct Context for the Image (Timeline + Billing)
                    const timelineSummary = visiblePhases.map((p, i) => {
                        return `${i + 1}. ${p.name}: ${new Date(p.start).toLocaleDateString('pt-BR')} a ${new Date(p.end).toLocaleDateString('pt-BR')} (${calculateBusinessDays(new Date(p.start), new Date(p.end))} dias)`;
                    }).join('\n');

                    const billingSummary = visiblePhases.map((p, i) => {
                        const percent = shares[i] || 0;
                        const dateStr = new Date(p.end).toLocaleDateString('pt-BR');
                        return `   - Milestone ${i + 1} (${p.name}): ${percent}% Faturamento na entrega em ${dateStr}`;
                    }).join('\n');

                    // 3. Build Prompt
                    const roadmapPrompt = `
                        Create a high-quality, professional Gantt Chart / Project Roadmap visualization.
                        Style: Modern Corporate, Clean, Minimalist. White background.
                        Color Palette: Indigo/Blue shades (Professional Tech).

                        Timeline Scope: Total ${totalDays} business days (~${Math.round(totalDays / 20)} months).
                        
                        Data to Visualize (DRAW THESE BARS AND LABELS CLEARLY):
                        ${timelineSummary}

                        BILLING MILESTONES (Must be visualized, e.g., as diamonds or flags at the end of phases):
                        ${billingSummary}

                        Instructions:
                        - Draw a horizontal timeline header with Months/Weeks.
                        - Draw horizontal bars for each phase listed above, respecting relative lengths.
                        - NUMBER the phases (1, 2, 3...) corresponding to the list.
                        - Include the Phase Name and Dates next to or inside the bars.
                        = IMPORTANT: Visualize the Billing Milestones (percentage and date) clearly at the end of each respective phase bar.
                        - Make text legible and sharp.
                        - High resolution, 16:9 aspect ratio suitable for a presentation slide.
                        - Do NOT add generic "Lorem Ipsum" text. Use the provided task names.
                    `;

                    // 4. Generate Image
                    const roadmapImageBase64 = await geminiService.generateImage(roadmapPrompt);

                    // 5. Add Image to Slide (Dimensions: 9.0" x 4.2" = ~22.86cm x 10.67cm)
                    slideRoadmap.addImage({
                        data: roadmapImageBase64,
                        x: 0.5, y: 1.0, w: 9.0, h: 4.2
                    });

                    // Add info note
                    slideRoadmap.addText(`Visualização gerada por IA (Estimativa: ${totalDays} dias úteis / ${totalHours}h)`, {
                        x: 0.5, y: 5.25, w: 9, h: 0.2, fontSize: 8, color: '999999', align: 'right'
                    });

                } catch (imgErr: any) {
                    console.error("Roadmap Image Gen Failed", imgErr);
                    // Fallback: Text List
                    slideRoadmap.addText("Cronograma Macro (Lista)", { x: 0.5, y: 1.2, w: 9, fontSize: 14, bold: true, color: '374151' });

                    const items = visiblePhases.map((p, i) => ({
                        text: `${i + 1}. ${p.name} (${new Date(p.start).toLocaleDateString('pt-BR')} - ${new Date(p.end).toLocaleDateString('pt-BR')})`,
                        options: { fontSize: 11, breakLine: true, bullet: { code: '2022' } }
                    }));
                    slideRoadmap.addText(items, { x: 0.5, y: 1.6, w: 9, h: 3.5, valign: 'top' });
                }

                // --- Disclaimer Text (Bottom) ---
                const DISCLAIMER_X = 0.5;
                const DISCLAIMER_W = 9.0;
                const DISCLAIMER_Y = 5.35;

                const disclaimerText = "Este cronograma macro apresenta uma visão executiva e não exaustiva das atividades previstas. As datas e durações são estimativas preliminares que poderão sofrer ajustes conforme o aprofundamento técnico preliminar.";

                slideRoadmap.addText(disclaimerText, {
                    x: DISCLAIMER_X, y: DISCLAIMER_Y, w: DISCLAIMER_W, h: 0.3,
                    fontSize: 7, color: '9CA3AF', align: 'center', valign: 'top', italic: true
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

                                // NEW: [budget] Tag replacement
                                const budgetContent = project.documentation?.budget || "";
                                text = text.replace(/\[budget\]/gi, budgetContent);

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
            await generateProjectContent();
        }
    }

    console.log("Writing file...");
    // Save
    pptx.writeFile({ fileName: `Proposta_${project.name}.pptx` });
};
