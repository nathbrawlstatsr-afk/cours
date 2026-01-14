// =================================================================
// ÉDUC-BIN IA - Système Éducatif avec IA (ChatGPT)
// Version: 4.0.0 IA
// Auteur: ÉDUC-BIN AI Team
// Licence: MIT
// =================================================================

// ==================== CONFIGURATION IA ====================
const EduConnectAI = {
    // 🤖 CONFIGURATION OPENAI/CHATGPT
    AI_CONFIG: {
        API_KEY: localStorage.getItem('openai_api_key') || '', // À configurer par l'utilisateur
        BASE_URL: 'https://api.openai.com/v1',
        MODELS: {
            GPT_4: 'gpt-4',
            GPT_3_5: 'gpt-3.5-turbo',
            GPT_3_5_16K: 'gpt-3.5-turbo-16k',
            EMBEDDINGS: 'text-embedding-3-small'
        },
        DEFAULT_MODEL: 'gpt-3.5-turbo',
        MAX_TOKENS: 4000,
        TEMPERATURE: 0.7,
        
        // Fallback à des modèles locaux si pas d'API
        FALLBACK_MODELS: {
            LOCAL: 'local-llm',
            MOCK: 'mock-ai'
        }
    },
    
    // 🧠 MÉMOIRE IA POUR PERSONNALISATION
    AI_MEMORY: {
        userPreferences: new Map(),
        learningStyles: new Map(),
        knowledgeGaps: new Map(),
        sessionContext: [],
        
        // Stocker le contexte de la session
        addContext: function(role, content) {
            this.sessionContext.push({ role, content, timestamp: Date.now() });
            // Garder seulement les 20 derniers messages
            if (this.sessionContext.length > 20) {
                this.sessionContext.shift();
            }
        },
        
        // Obtenir le contexte pour la session
        getContext: function() {
            return this.sessionContext.slice(-10); // 10 derniers messages
        },
        
        // Analyser le style d'apprentissage
        analyzeLearningStyle: function(userId, interactions) {
            const styles = {
                visual: 0,
                auditory: 0,
                reading: 0,
                kinesthetic: 0
            };
            
            interactions.forEach(interaction => {
                if (interaction.type === 'video_watch') styles.visual += 2;
                if (interaction.type === 'audio_play') styles.auditory += 2;
                if (interaction.type === 'text_read') styles.reading += 2;
                if (interaction.type === 'quiz_attempt') styles.kinesthetic += 1;
                if (interaction.type === 'exercise_complete') styles.kinesthetic += 2;
            });
            
            // Déterminer le style dominant
            let dominantStyle = 'reading';
            let maxScore = 0;
            
            for (const [style, score] of Object.entries(styles)) {
                if (score > maxScore) {
                    maxScore = score;
                    dominantStyle = style;
                }
            }
            
            this.learningStyles.set(userId, {
                style: dominantStyle,
                scores: styles,
                lastUpdated: Date.now()
            });
            
            return dominantStyle;
        },
        
        // Détecter les lacunes de connaissances
        detectKnowledgeGaps: function(userId, quizResults) {
            const gaps = {};
            
            quizResults.forEach(result => {
                if (result.score < 70) { // Score inférieur à 70%
                    if (!gaps[result.topic]) {
                        gaps[result.topic] = {
                            weakAreas: [],
                            averageScore: 0,
                            attempts: 0
                        };
                    }
                    
                    gaps[result.topic].weakAreas.push(...result.incorrectQuestions.map(q => q.concept));
                    gaps[result.topic].averageScore = (
                        (gaps[result.topic].averageScore * gaps[result.topic].attempts) + result.score
                    ) / (gaps[result.topic].attempts + 1);
                    gaps[result.topic].attempts++;
                }
            });
            
            this.knowledgeGaps.set(userId, {
                gaps: gaps,
                lastAnalysis: Date.now(),
                recommendations: this.generateRecommendations(gaps)
            });
            
            return gaps;
        },
        
        // Générer des recommandations
        generateRecommendations: function(gaps) {
            const recommendations = [];
            
            for (const [topic, data] of Object.entries(gaps)) {
                if (data.averageScore < 50) {
                    recommendations.push({
                        priority: 'high',
                        topic: topic,
                        action: `Réviser les bases de ${topic} avec des exercices simples`,
                        resources: ['fiches_de_base', 'vidéos_tutoriels', 'quiz_débutant']
                    });
                } else if (data.averageScore < 70) {
                    recommendations.push({
                        priority: 'medium',
                        topic: topic,
                        action: `Pratiquer ${topic} avec des exercices progressifs`,
                        resources: ['exercices_progressifs', 'corrigés_détaillés', 'quiz_intermédiaire']
                    });
                } else {
                    recommendations.push({
                        priority: 'low',
                        topic: topic,
                        action: `Consolider ${topic} avec des défis`,
                        resources: ['problèmes_complexes', 'défis_avancés', 'quiz_expert']
                    });
                }
            }
            
            return recommendations.sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
        }
    },
    
    // 📚 GÉNÉRATEUR DE CONTENU IA
    ContentGenerator: {
        
        // Générer un cours complet avec IA
        async generateCourse(subject, level, topic, learningStyle = 'reading') {
            console.log(`🤖 Génération IA: Cours ${subject} ${level} - ${topic}`);
            
            const prompt = this.buildCoursePrompt(subject, level, topic, learningStyle);
            
            try {
                const aiResponse = await this.callAI(prompt);
                const course = this.parseCourseResponse(aiResponse, subject, level, topic);
                
                // Enrichir avec des ressources supplémentaires
                course.resources = await this.generateCourseResources(subject, topic, learningStyle);
                course.quiz = await this.generateQuizForCourse(course);
                course.flashcards = await this.generateFlashcards(course.keyConcepts);
                
                // Ajouter des métadonnées
                course.metadata = {
                    generatedBy: 'AI',
                    generationDate: new Date().toISOString(),
                    model: EduConnectAI.AI_CONFIG.DEFAULT_MODEL,
                    learningStyle: learningStyle,
                    estimatedStudyTime: this.calculateStudyTime(course.content)
                };
                
                return course;
                
            } catch (error) {
                console.error('Erreur génération cours:', error);
                return this.generateFallbackCourse(subject, level, topic);
            }
        },
        
        // Construire le prompt pour ChatGPT
        buildCoursePrompt(subject, level, topic, learningStyle) {
            const styleInstructions = {
                visual: "Inclus des explications visuelles, des diagrammes à décrire, et des analogies visuelles.",
                auditory: "Utilise un langage oral, des exemples parlants, et une structure qui pourrait être expliquée à voix haute.",
                reading: "Structure le contenu de manière textuelle claire, avec des paragraphes bien organisés et des listes.",
                kinesthetic: "Propose des activités pratiques, des exercices à réaliser, et des applications concrètes."
            };
            
            return `Tu es un expert en pédagogie et en ${subject} pour le niveau ${level} (collège français).
            
            Crée un cours complet sur le thème: "${topic}"

            CONTEXTE:
            - Niveau scolaire: ${level}
            - Matière: ${subject}
            - Style d'apprentissage de l'élève: ${learningStyle}
            - ${styleInstructions[learningStyle]}

            EXIGENCES:
            1. Structure le cours selon le programme de l'Éducation Nationale
            2. Adapte le contenu au niveau ${level}
            3. Utilise un langage clair et pédagogique
            4. Inclus des exemples concrets
            5. Propose des applications pratiques

            FORMAT DE RÉPONSE (JSON):
            {
              "title": "Titre attractif du cours",
              "subject": "${subject}",
              "level": "${level}",
              "topic": "${topic}",
              "objectives": ["objectif 1", "objectif 2", "objectif 3"],
              "duration": "1h30",
              "difficulty": "facile|moyen|difficile",
              "keyConcepts": ["concept1", "concept2", "concept3"],
              "content": {
                "introduction": "Introduction captivante",
                "sections": [
                  {
                    "title": "Titre section 1",
                    "content": "Contenu détaillé...",
                    "examples": ["exemple 1", "exemple 2"]
                  }
                ],
                "summary": "Résumé des points clés",
                "realWorldApplications": "Applications dans la vie réelle"
              },
              "prerequisites": ["prérequis 1", "prérequis 2"],
              "targetSkills": ["compétence 1", "compétence 2"]
            }

            IMPORTANT: Réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.`;
        },
        
        // Appeler l'API ChatGPT
        async callAI(prompt, systemMessage = null) {
            // Vérifier si une clé API est configurée
            if (!EduConnectAI.AI_CONFIG.API_KEY) {
                return this.mockAIResponse(prompt);
            }
            
            const messages = [];
            
            if (systemMessage) {
                messages.push({ role: 'system', content: systemMessage });
            }
            
            messages.push({ role: 'user', content: prompt });
            
            try {
                const response = await fetch(`${EduConnectAI.AI_CONFIG.BASE_URL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${EduConnectAI.AI_CONFIG.API_KEY}`
                    },
                    body: JSON.stringify({
                        model: EduConnectAI.AI_CONFIG.DEFAULT_MODEL,
                        messages: messages,
                        temperature: EduConnectAI.AI_CONFIG.TEMPERATURE,
                        max_tokens: EduConnectAI.AI_CONFIG.MAX_TOKENS,
                        response_format: { type: 'json_object' }
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                
                const data = await response.json();
                return data.choices[0].message.content;
                
            } catch (error) {
                console.error('Erreur API OpenAI:', error);
                return this.mockAIResponse(prompt);
            }
        },
        
        // Réponse mock pour développement
        mockAIResponse(prompt) {
            console.log('⚠️ Utilisation du mode mock IA');
            
            // Analyser le prompt pour déterminer le type de contenu
            if (prompt.includes('Crée un cours complet')) {
                return JSON.stringify({
                    title: "Introduction aux fractions - Niveau 6ème",
                    subject: "maths",
                    level: "6e",
                    topic: "fractions",
                    objectives: [
                        "Comprendre la notion de fraction",
                        "Savoir représenter une fraction",
                        "Comparer des fractions simples"
                    ],
                    duration: "1h30",
                    difficulty: "facile",
                    keyConcepts: ["numérateur", "dénominateur", "fraction égale", "comparaison"],
                    content: {
                        introduction: "Les fractions sont partout dans notre quotidien...",
                        sections: [
                            {
                                title: "Qu'est-ce qu'une fraction?",
                                content: "Une fraction représente une partie d'un tout...",
                                examples: ["1/2 d'une pizza", "3/4 d'une heure"]
                            }
                        ],
                        summary: "Les fractions permettent de représenter des parts...",
                        realWorldApplications: "Recettes de cuisine, mesure du temps, partage équitable"
                    },
                    prerequisites: ["nombres entiers", "division simple"],
                    targetSkills: ["représentation fractionnaire", "comparaison de fractions"]
                });
            }
            
            if (prompt.includes('Génère un quiz de')) {
                return JSON.stringify({
                    title: "Quiz sur les fractions",
                    subject: "maths",
                    level: "6e",
                    difficulty: "facile",
                    questions: [
                        {
                            question: "Que représente le chiffre du bas dans une fraction?",
                            options: ["Le numérateur", "Le dénominateur", "Le quotient", "Le reste"],
                            correctAnswer: 1,
                            explanation: "Le dénominateur indique en combien de parts égales est divisé le tout.",
                            points: 10
                        }
                    ],
                    passingScore: 70,
                    timeLimit: 600
                });
            }
            
            return JSON.stringify({ error: "Mode mock - Réponse par défaut" });
        },
        
        // Parser la réponse IA en cours structuré
        parseCourseResponse(aiResponse, subject, level, topic) {
            try {
                const course = JSON.parse(aiResponse);
                
                // Validation et nettoyage
                course.id = `ai-${subject}-${level}-${Date.now()}`;
                course.generatedAt = new Date().toISOString();
                course.rating = 4.0;
                course.views = 0;
                course.completions = 0;
                course.isAIGenerated = true;
                
                // Formatage du contenu pour l'affichage
                if (course.content && course.content.sections) {
                    let formattedContent = `# ${course.title}\n\n`;
                    formattedContent += `## Introduction\n${course.content.introduction}\n\n`;
                    
                    course.content.sections.forEach((section, index) => {
                        formattedContent += `## ${section.title}\n`;
                        formattedContent += `${section.content}\n\n`;
                        
                        if (section.examples && section.examples.length > 0) {
                            formattedContent += `### Exemples\n`;
                            section.examples.forEach(example => {
                                formattedContent += `- ${example}\n`;
                            });
                            formattedContent += `\n`;
                        }
                    });
                    
                    formattedContent += `## Résumé\n${course.content.summary}\n\n`;
                    formattedContent += `## Applications pratiques\n${course.content.realWorldApplications}`;
                    
                    course.formattedContent = formattedContent;
                }
                
                return course;
                
            } catch (error) {
                console.error('Erreur parsing réponse IA:', error);
                throw new Error('Réponse IA invalide');
            }
        },
        
        // Générer des ressources pour le cours
        async generateCourseResources(subject, topic, learningStyle) {
            const resources = [];
            
            // Générer des exercices
            const exercises = await this.generateExercises(subject, topic, 3);
            resources.push({
                type: 'exercises',
                title: 'Exercices pratiques',
                content: exercises,
                format: 'interactive'
            });
            
            // Générer des vidéos recommandées (liens YouTube éducatifs)
            const videoLinks = await this.findEducationalVideos(topic);
            resources.push({
                type: 'videos',
                title: 'Vidéos complémentaires',
                content: videoLinks,
                format: 'external'
            });
            
            // Générer une fiche de révision
            const summarySheet = await this.generateSummarySheet(topic);
            resources.push({
                type: 'summary',
                title: 'Fiche de révision',
                content: summarySheet,
                format: 'pdf'
            });
            
            return resources;
        },
        
        // Générer des exercices avec IA
        async generateExercises(subject, topic, count = 3) {
            const prompt = `Génère ${count} exercices progressifs sur le thème "${topic}" en ${subject} pour collégiens.
            
            Pour chaque exercice, fournis:
            1. L'énoncé du problème
            2. Des indices progressifs (3 niveaux)
            3. La solution détaillée
            4. Le niveau de difficulté (facile, moyen, difficile)
            
            Format JSON:
            {
              "exercises": [
                {
                  "title": "Titre de l'exercice",
                  "statement": "Énoncé clair...",
                  "hints": ["Indice 1", "Indice 2", "Indice 3"],
                  "solution": "Solution détaillée...",
                  "difficulty": "facile",
                  "skills": ["compétence1", "compétence2"]
                }
              ]
            }`;
            
            try {
                const response = await this.callAI(prompt);
                return JSON.parse(response).exercises;
            } catch (error) {
                // Exercices par défaut
                return [
                    {
                        title: "Exercice d'application",
                        statement: "Applique le concept appris à un cas simple.",
                        hints: ["Relis la définition", "Cherche un exemple similaire", "Décompose le problème"],
                        solution: "Solution type avec explications",
                        difficulty: "facile",
                        skills: ["application"]
                    }
                ];
            }
        },
        
        // Trouver des vidéos éducatives
        async findEducationalVideos(topic) {
            // Recherche simulée - en production, utiliser l'API YouTube
            const videoTopics = [
                `${topic} explication simple`,
                `${topic} cours complet`,
                `${topic} exercices corrigés`,
                `${topic} animation pédagogique`
            ];
            
            return videoTopics.map((search, index) => ({
                id: `video-${index}`,
                title: `Vidéo sur ${topic}`,
                description: `Explication vidéo de ${topic}`,
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(search)}`,
                duration: "5-10 minutes",
                source: "YouTube",
                rating: 4.5
            }));
        },
        
        // Générer une fiche de révision
        async generateSummarySheet(topic) {
            const prompt = `Crée une fiche de révision concise et efficace sur le thème "${topic}".
            
            Inclus:
            1. Définition claire
            2. Points clés à retenir
            3. Formules importantes (si applicable)
            4. Exemples types
            5. Erreurs fréquentes à éviter
            6. Astuces mémorisation
            
            Format: Markdown pour impression`;
            
            try {
                return await this.callAI(prompt);
            } catch (error) {
                return `# Fiche de révision: ${topic}\n\n## Points clés\n- Point important 1\n- Point important 2\n\n## À retenir\nInformations essentielles...`;
            }
        },
        
        // Générer un quiz pour le cours
        async generateQuizForCourse(course) {
            const prompt = `Génère un quiz de 10 questions sur le cours suivant:
            
            Titre: ${course.title}
            Concepts clés: ${course.keyConcepts.join(', ')}
            Niveau: ${course.level}
            
            Règles:
            1. Questions progressives (facile → difficile)
            2. 4 options par question
            3. Une seule réponse correcte
            4. Explication pour chaque réponse
            5. Points proportionnels à la difficulté
            
            Format JSON:
            {
              "title": "Quiz: ${course.title}",
              "questions": [
                {
                  "id": "q1",
                  "question": "Question texte...",
                  "options": ["A", "B", "C", "D"],
                  "correctAnswer": 0,
                  "explanation": "Explication détaillée...",
                  "difficulty": "facile|moyen|difficile",
                  "points": 10,
                  "concept": "concept testé"
                }
              ],
              "passingScore": 70,
              "timeLimit": 900
            }`;
            
            try {
                const response = await this.callAI(prompt);
                return JSON.parse(response);
            } catch (error) {
                return this.generateFallbackQuiz(course);
            }
        },
        
        // Générer des flashcards
        async generateFlashcards(concepts) {
            const flashcards = [];
            
            for (const concept of concepts) {
                const prompt = `Crée une flashcard pour le concept: "${concept}"
                
                Format:
                Recto: Question ou terme à définir
                Verso: Réponse détaillée avec exemple
                
                JSON:
                {
                  "front": "Question sur le concept",
                  "back": "Réponse avec explication et exemple",
                  "concept": "${concept}",
                  "difficulty": "facile",
                  "category": "définition"
                }`;
                
                try {
                    const response = await this.callAI(prompt);
                    flashcards.push(JSON.parse(response));
                } catch (error) {
                    flashcards.push({
                        front: `Qu'est-ce que ${concept}?`,
                        back: `Définition de ${concept} avec exemple.`,
                        concept: concept,
                        difficulty: "facile",
                        category: "définition"
                    });
                }
            }
            
            return flashcards;
        },
        
        // Calculer le temps d'étude estimé
        calculateStudyTime(content) {
            const wordCount = content.split(/\s+/).length;
            const readingTime = Math.ceil(wordCount / 200); // 200 mots/minute
            const exerciseTime = 15; // minutes pour les exercices
            const reviewTime = 10; // minutes pour la révision
            
            return readingTime + exerciseTime + reviewTime;
        },
        
        // Cours de secours
        generateFallbackCourse(subject, level, topic) {
            return {
                id: `fallback-${subject}-${level}-${Date.now()}`,
                title: `${topic} - ${level}`,
                subject: subject,
                level: level,
                topic: topic,
                objectives: ["Comprendre les bases", "Appliquer les concepts"],
                duration: "1h",
                difficulty: "moyen",
                keyConcepts: ["concept1", "concept2"],
                content: {
                    introduction: `Introduction à ${topic}`,
                    sections: [
                        {
                            title: "Les bases",
                            content: "Contenu de base sur le sujet.",
                            examples: ["Exemple simple"]
                        }
                    ],
                    summary: "Résumé des points importants",
                    realWorldApplications: "Applications pratiques"
                },
                isAIGenerated: false,
                isFallback: true,
                formattedContent: `# ${topic}\n\nContenu de base pour commencer l'apprentissage.`
            };
        },
        
        // Quiz de secours
        generateFallbackQuiz(course) {
            return {
                title: `Quiz: ${course.title}`,
                questions: [
                    {
                        id: "q1",
                        question: "Question de base sur le sujet?",
                        options: ["Option A", "Option B", "Option C", "Option D"],
                        correctAnswer: 0,
                        explanation: "Explication simple",
                        difficulty: "facile",
                        points: 10,
                        concept: "concept de base"
                    }
                ],
                passingScore: 70,
                timeLimit: 600
            };
        }
    },
    
    // 🎯 TUTEUR IA PERSONNALISÉ
    AITutor: {
        currentSession: null,
        conversationHistory: [],
        
        // Démarrer une session de tutorat
        async startSession(userId, subject = null, topic = null) {
            this.currentSession = {
                id: `tutor-session-${Date.now()}`,
                userId: userId,
                subject: subject,
                topic: topic,
                startTime: Date.now(),
                messages: [],
                learningObjectives: [],
                difficulties: []
            };
            
            // Charger le contexte utilisateur
            const userContext = EduConnectAI.AI_MEMORY.getContext();
            const learningStyle = EduConnectAI.AI_MEMORY.learningStyles.get(userId)?.style || 'reading';
            const knowledgeGaps = EduConnectAI.AI_MEMORY.knowledgeGaps.get(userId)?.gaps || {};
            
            // Générer un message de bienvenue personnalisé
            const welcomeMessage = await this.generateWelcomeMessage(
                subject, 
                topic, 
                learningStyle, 
                knowledgeGaps
            );
            
            this.currentSession.messages.push({
                role: 'assistant',
                content: welcomeMessage,
                timestamp: Date.now()
            });
            
            return {
                sessionId: this.currentSession.id,
                welcomeMessage: welcomeMessage,
                suggestedTopics: await this.suggestTopics(subject, knowledgeGaps)
            };
        },
        
        // Générer un message de bienvenue personnalisé
        async generateWelcomeMessage(subject, topic, learningStyle, knowledgeGaps) {
            const prompt = `Tu es un tuteur pédagogique bienveillant et encourageant.
            
            Élève: Style d'apprentissage ${learningStyle}
            ${subject ? `Matière: ${subject}` : ''}
            ${topic ? `Thème: ${topic}` : ''}
            ${Object.keys(knowledgeGaps).length > 0 ? 
                `Lacunes détectées: ${Object.keys(knowledgeGaps).join(', ')}` : 
                'Pas de lacunes significatives détectées'}
            
            Génère un message d'accueil chaleureux et motivant qui:
            1. Accueille l'élève par son nom (utilise "tu")
            2. Propose une aide adaptée à son style d'apprentissage
            3. Suggère une approche personnalisée
            4. Encourage et motive
            5. Demande sur quoi l'élève souhaite travailler
            
            Ton: Amical, encourageant, pédagogique, pas trop formel`;
            
            try {
                return await EduConnectAI.ContentGenerator.callAI(prompt);
            } catch (error) {
                return `Bonjour ! Je suis ton tuteur IA. Je suis là pour t'aider dans tes apprentissages. 
                Sur quel sujet souhaites-tu travailler aujourd'hui ?`;
            }
        },
        
        // Suggérer des sujets basés sur les lacunes
        async suggestTopics(subject, knowledgeGaps) {
            const topics = [];
            
            if (Object.keys(knowledgeGaps).length > 0) {
                // Priorité aux sujets avec des lacunes
                for (const [topic, data] of Object.entries(knowledgeGaps)) {
                    if (data.averageScore < 70) {
                        topics.push({
                            topic: topic,
                            priority: data.averageScore < 50 ? 'high' : 'medium',
                            reason: `Score moyen: ${Math.round(data.averageScore)}%`,
                            suggestedActivities: this.getActivitiesForGap(data)
                        });
                    }
                }
            }
            
            // Ajouter des sujets généraux si nécessaire
            if (topics.length < 3) {
                const generalTopics = await this.getGeneralTopics(subject);
                topics.push(...generalTopics.slice(0, 3 - topics.length));
            }
            
            return topics.slice(0, 5); // Maximum 5 suggestions
        },
        
        // Obtenir des activités pour combler une lacune
        getActivitiesForGap(gapData) {
            const activities = [];
            
            if (gapData.averageScore < 50) {
                activities.push(
                    'Révision des bases avec fiches simples',
                    'Exercices guidés pas à pas',
                    'Vidéos explicatives courtes'
                );
            } else if (gapData.averageScore < 70) {
                activities.push(
                    'Exercices progressifs avec corrigés',
                    'Quiz d\'entraînement',
                    'Mise en situation pratique'
                );
            } else {
                activities.push(
                    'Problèmes complexes',
                    'Défis de réflexion',
                    'Applications avancées'
                );
            }
            
            return activities;
        },
        
        // Obtenir des sujets généraux pour une matière
        async getGeneralTopics(subject) {
            const topicsBySubject = {
                maths: ['Fractions', 'Géométrie', 'Algèbre', 'Proportions', 'Statistiques'],
                francais: ['Grammaire', 'Conjugaison', 'Orthographe', 'Lecture', 'Rédaction'],
                histoire: ['Moyen Âge', 'Renaissance', 'Révolution', 'Guerres mondiales', 'Union européenne'],
                geo: ['Climats', 'Population', 'Villes', 'Développement', 'Mondialisation']
            };
            
            return (topicsBySubject[subject] || ['Bases', 'Applications', 'Approfondissement']).map(topic => ({
                topic: topic,
                priority: 'low',
                reason: 'Suggestion générale',
                suggestedActivities: ['Cours complet', 'Exercices variés', 'Quiz d\'évaluation']
            }));
        },
        
        // Répondre à une question de l'élève
        async answerQuestion(question, context = '') {
            if (!this.currentSession) {
                await this.startSession('anonymous');
            }
            
            // Ajouter la question à l'historique
            this.currentSession.messages.push({
                role: 'user',
                content: question,
                timestamp: Date.now()
            });
            
            // Préparer le contexte pour l'IA
            const sessionContext = this.currentSession.messages
                .slice(-6) // 3 derniers échanges
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');
            
            const learningStyle = EduConnectAI.AI_MEMORY.learningStyles.get(this.currentSession.userId)?.style || 'reading';
            
            const prompt = `Tu es un tuteur pédagogique expert. Réponds à la question de l'élève.
            
            CONTEXTE DE LA SESSION:
            ${sessionContext}
            
            STYLE D'APPRENTISSAGE DE L'ÉLÈVE: ${learningStyle}
            ${context ? `CONTEXTE SUPPLÉMENTAIRE: ${context}` : ''}
            
            QUESTION DE L'ÉLÈVE: ${question}
            
            RÈGLES POUR TA RÉPONSE:
            1. Sois précis et pédagogique
            2. Adapte-toi au style d'apprentissage (${learningStyle})
            3. Utilise des exemples concrets
            4. Pose une question de suivi pour vérifier la compréhension
            5. Encourage et motive
            6. Propose une activité pratique si pertinent
            
            Format: Réponse naturelle, pas de formatage spécial.`;
            
            try {
                const response = await EduConnectAI.ContentGenerator.callAI(prompt);
                
                // Ajouter la réponse à l'historique
                this.currentSession.messages.push({
                    role: 'assistant',
                    content: response,
                    timestamp: Date.now()
                });
                
                // Analyser la question pour détecter des difficultés
                this.analyzeQuestionForDifficulties(question, response);
                
                return response;
                
            } catch (error) {
                console.error('Erreur réponse tuteur:', error);
                return `Je suis désolé, j'ai eu du mal à traiter ta question. Pourrais-tu la reformuler ? 
                Sinon, je peux t'aider avec un sujet spécifique comme les fractions ou la grammaire.`;
            }
        },
        
        // Analyser la question pour détecter des difficultés
        analyzeQuestionForDifficulties(question, response) {
            // Détection simple de confusion
            const confusionIndicators = [
                'je ne comprends pas',
                'confus',
                'pas clair',
                'compliqué',
                'difficile',
                'perdu'
            ];
            
            const isConfused = confusionIndicators.some(indicator => 
                question.toLowerCase().includes(indicator)
            );
            
            if (isConfused) {
                this.currentSession.difficulties.push({
                    type: 'confusion',
                    topic: this.extractTopic(question),
                    timestamp: Date.now(),
                    question: question
                });
                
                // Mettre à jour la mémoire IA
                EduConnectAI.AI_MEMORY.addContext('system', 
                    `Élève en difficulté sur: ${this.extractTopic(question)}`);
            }
        },
        
        // Extraire le sujet d'une question
        extractTopic(question) {
            // Analyse simple - en production, utiliser NLP
            const topicKeywords = {
                maths: ['fraction', 'équation', 'géométrie', 'calcul', 'algèbre'],
                francais: ['grammaire', 'conjugaison', 'orthographe', 'texte', 'rédaction'],
                histoire: ['date', 'événement', 'personnage', 'période', 'guerre'],
                geo: ['carte', 'pays', 'ville', 'climat', 'population']
            };
            
            for (const [subject, keywords] of Object.entries(topicKeywords)) {
                for (const keyword of keywords) {
                    if (question.toLowerCase().includes(keyword)) {
                        return `${subject}: ${keyword}`;
                    }
                }
            }
            
            return 'sujet non identifié';
        },
        
        // Générer un exercice personnalisé
        async generatePersonalizedExercise(topic, difficulty = 'medium') {
            const prompt = `Génère un exercice personnalisé sur le thème "${topic}" de difficulté ${difficulty}.
            
            L'exercice doit:
            1. Être progressif (commencer simple)
            2. Inclure des indices adaptatifs
            3. Avoir une solution détaillée
            4. Être contextualisé (histoire, application pratique)
            5. Prendre 5-10 minutes à résoudre
            
            Format:
            Titre: [Titre attractif]
            Énoncé: [Situation problématique]
            Questions: [1-2 questions guidées]
            Indices: [3 indices progressifs]
            Solution: [Explication complète]
            Compétences travaillées: [liste]`;
            
            try {
                return await EduConnectAI.ContentGenerator.callAI(prompt);
            } catch (error) {
                return `Exercice sur ${topic}:
                
                Énoncé: Applique le concept de ${topic} à une situation simple.
                
                Indice 1: Relis la définition.
                Indice 2: Cherche un exemple similaire.
                Indice 3: Décompose le problème.
                
                Solution: Solution type avec explications.`;
            }
        },
        
        // Terminer la session et générer un résumé
        async endSession() {
            if (!this.currentSession) return null;
            
            const sessionDuration = Date.now() - this.currentSession.startTime;
            const minutes = Math.round(sessionDuration / 60000);
            
            const prompt = `Résume la session de tutorat suivante:
            
            Durée: ${minutes} minutes
            Sujets abordés: ${this.currentSession.topic || 'divers'}
            Difficultés rencontrées: ${this.currentSession.difficulties.length}
            Nombre d'échanges: ${this.currentSession.messages.length}
            
            Génère un résumé pour l'élève qui:
            1. Fait le point sur ce qui a été appris
            2. Souligne les progrès
            3. Donne des recommandations pour la suite
            4. Encourage et motive pour la prochaine session
            
            Ton: Positif, constructif, motivant`;
            
            try {
                const summary = await EduConnectAI.ContentGenerator.callAI(prompt);
                
                const sessionReport = {
                    sessionId: this.currentSession.id,
                    duration: minutes,
                    topicsCovered: this.currentSession.topic ? [this.currentSession.topic] : [],
                    difficulties: this.currentSession.difficulties,
                    messageCount: this.currentSession.messages.length,
                    summary: summary,
                    recommendations: await this.generateFollowUpRecommendations()
                };
                
                // Sauvegarder le rapport
                await this.saveSessionReport(sessionReport);
                
                // Réinitialiser la session
                this.currentSession = null;
                this.conversationHistory = [];
                
                return sessionReport;
                
            } catch (error) {
                console.error('Erreur fin de session:', error);
                return null;
            }
        },
        
        // Générer des recommandations de suivi
        async generateFollowUpRecommendations() {
            if (!this.currentSession) return [];
            
            const recommendations = [];
            
            // Basé sur les difficultés
            if (this.currentSession.difficulties.length > 0) {
                recommendations.push({
                    type: 'remediation',
                    action: 'Réviser les points difficiles avec des exercices ciblés',
                    priority: 'high',
                    estimatedTime: '20 minutes'
                });
            }
            
            // Basé sur la durée
            const sessionDuration = Date.now() - this.currentSession.startTime;
            if (sessionDuration < 600000) { // Moins de 10 minutes
                recommendations.push({
                    type: 'practice',
                    action: 'Pratiquer avec un quiz sur le sujet',
                    priority: 'medium',
                    estimatedTime: '15 minutes'
                });
            }
            
            // Recommandation générale
            recommendations.push({
                type: 'consolidation',
                action: 'Revoir la fiche de révision dans 24h (courbe de l\'oubli)',
                priority: 'medium',
                estimatedTime: '10 minutes'
            });
            
            return recommendations;
        },
        
        // Sauvegarder le rapport de session
        async saveSessionReport(report) {
            try {
                // Sauvegarde locale
                const sessions = JSON.parse(localStorage.getItem('ai_tutor_sessions') || '[]');
                sessions.push(report);
                localStorage.setItem('ai_tutor_sessions', JSON.stringify(sessions));
                
                // Synchroniser avec le backend si en ligne
                if (navigator.onLine) {
                    await this.syncSessionReport(report);
                }
                
                console.log('✅ Rapport de session sauvegardé');
            } catch (error) {
                console.error('Erreur sauvegarde session:', error);
            }
        },
        
        // Synchroniser le rapport
        async syncSessionReport(report) {
            // Implémenter la synchronisation avec JSONBin.io
            const sessions = await this.getRemoteSessions();
            sessions.push(report);
            
            // Limiter à 50 sessions maximum
            if (sessions.length > 50) {
                sessions.splice(0, sessions.length - 50);
            }
            
            // Sauvegarder
            await this.saveToJSONBin('tutor_sessions', sessions);
        },
        
        // Récupérer les sessions distantes
        async getRemoteSessions() {
            try {
                const response = await fetch(
                    `${EduConnectAI.JSONBIN.BASE_URL}/${EduConnectAI.JSONBIN.BINS.main}/latest`,
                    { headers: EduConnectAI.JSONBIN.HEADERS }
                );
                const data = await response.json();
                return data.record.tutor_sessions || [];
            } catch (error) {
                return [];
            }
        },
        
        // Sauvegarder dans JSONBin
        async saveToJSONBin(key, data) {
            try {
                await fetch(
                    `${EduConnectAI.JSONBIN.BASE_URL}/${EduConnectAI.JSONBIN.BINS.main}`,
                    {
                        method: 'PUT',
                        headers: EduConnectAI.JSONBIN.HEADERS,
                        body: JSON.stringify({ [key]: data })
                    }
                );
            } catch (error) {
                console.error('Erreur sauvegarde JSONBin:', error);
            }
        }
    },
    
    // 📊 GÉNÉRATEUR DE QUIZ AVANCÉ
    QuizGenerator: {
        
        // Générer un quiz personnalisé
        async generateQuiz(options) {
            const {
                subject,
                level,
                topic,
                difficulty = 'medium',
                questionCount = 10,
                questionTypes = ['multiple-choice', 'true-false', 'short-answer'],
                includeExplanations = true
            } = options;
            
            console.log(`🤖 Génération quiz: ${subject} ${level} - ${topic}`);
            
            const prompt = this.buildQuizPrompt(
                subject, level, topic, difficulty, questionCount, questionTypes
            );
            
            try {
                const aiResponse = await EduConnectAI.ContentGenerator.callAI(prompt);
                const quiz = this.parseQuizResponse(aiResponse, options);
                
                // Enrichir avec des métadonnées
                quiz.metadata = {
                    generatedBy: 'AI',
                    generationDate: new Date().toISOString(),
                    model: EduConnectAI.AI_CONFIG.DEFAULT_MODEL,
                    parameters: options,
                    estimatedTime: this.calculateQuizTime(quiz)
                };
                
                // Générer des explications si demandé
                if (includeExplanations) {
                    quiz.questions = await this.enrichWithExplanations(quiz.questions, subject);
                }
                
                return quiz;
                
            } catch (error) {
                console.error('Erreur génération quiz:', error);
                return this.generateFallbackQuiz(options);
            }
        },
        
        // Construire le prompt pour le quiz
        buildQuizPrompt(subject, level, topic, difficulty, questionCount, questionTypes) {
            const difficultyInstructions = {
                easy: "Questions basiques, rappel de définitions, applications directes",
                medium: "Questions nécessitant une réflexion, applications contextuelles",
                hard: "Questions complexes, raisonnement avancé, problèmes à étapes"
            };
            
            const typeInstructions = {
                'multiple-choice': "4 options, une seule correcte",
                'true-false': "Affirmation vraie ou fausse",
                'short-answer': "Réponse courte (1-2 mots)",
                'matching': "Association entre deux colonnes",
                'fill-blank': "Phrase à trous"
            };
            
            const selectedInstructions = questionTypes.map(type => typeInstructions[type] || type);
            
            return `Tu es un expert en création de quiz pédagogiques pour le niveau ${level} en ${subject}.
            
            Crée un quiz de ${questionCount} questions sur le thème: "${topic}"
            
            DIFFICULTÉ: ${difficulty}
            ${difficultyInstructions[difficulty]}
            
            TYPES DE QUESTIONS: ${selectedInstructions.join(', ')}
            
            EXIGENCES:
            1. Varier les types de questions
            2. Progresser en difficulté
            3. Couvrir les concepts importants
            4. Être conforme au programme scolaire
            5. Utiliser un langage clair et précis
            
            FORMAT DE RÉPONSE (JSON):
            {
              "title": "Quiz: ${topic} - Niveau ${level}",
              "subject": "${subject}",
              "level": "${level}",
              "topic": "${topic}",
              "difficulty": "${difficulty}",
              "questions": [
                {
                  "id": "q1",
                  "type": "question_type",
                  "question": "Texte de la question...",
                  "options": ["option1", "option2", "option3", "option4"], // si applicable
                  "correctAnswer": 0, // index ou texte selon le type
                  "explanation": "Explication pédagogique...",
                  "points": 10,
                  "timeLimit": 60, // secondes
                  "concept": "concept_testé"
                }
              ],
              "passingScore": 70,
              "timeLimit": ${questionCount * 60}, // secondes total
              "shuffleQuestions": true
            }
            
            IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;
        },
        
        // Parser la réponse du quiz
        parseQuizResponse(aiResponse, options) {
            try {
                const quiz = JSON.parse(aiResponse);
                
                // Validation et enrichissement
                quiz.id = `quiz-${options.subject}-${options.level}-${Date.now()}`;
                quiz.createdAt = new Date().toISOString();
                quiz.version = '1.0';
                quiz.isAIGenerated = true;
                
                // Validation des questions
                quiz.questions = quiz.questions.map((q, index) => ({
                    ...q,
                    id: q.id || `q${index + 1}`,
                    points: q.points || 10,
                    timeLimit: q.timeLimit || 60,
                    concept: q.concept || options.topic
                }));
                
                return quiz;
                
            } catch (error) {
                console.error('Erreur parsing quiz:', error);
                throw new Error('Réponse quiz invalide');
            }
        },
        
        // Calculer le temps estimé du quiz
        calculateQuizTime(quiz) {
            const baseTime = quiz.questions.length * 60; // 60 secondes par question
            const difficultyMultiplier = {
                easy: 0.8,
                medium: 1,
                hard: 1.5
            };
            
            return Math.round(baseTime * (difficultyMultiplier[quiz.difficulty] || 1));
        },
        
        // Enrichir avec des explications
        async enrichWithExplanations(questions, subject) {
            for (let question of questions) {
                if (!question.explanation || question.explanation.length < 20) {
                    question.explanation = await this.generateExplanation(
                        question.question,
                        question.correctAnswer,
                        subject
                    );
                }
            }
            return questions;
        },
        
        // Générer une explication pédagogique
        async generateExplanation(question, correctAnswer, subject) {
            const prompt = `Pour la question suivante en ${subject}, génère une explication pédagogique:
            
            Question: ${question}
            Réponse correcte: ${correctAnswer}
            
            L'explication doit:
            1. Expliquer pourquoi cette réponse est correcte
            2. Expliquer pourquoi les autres options sont incorrectes (si applicable)
            3. Donner un exemple concret
            4. Proposer une astuce pour retenir
            
            Format: Texte clair, maximum 3 phrases.`;
            
            try {
                return await EduConnectAI.ContentGenerator.callAI(prompt);
            } catch (error) {
                return "Cette réponse est correcte car elle correspond à la définition du concept.";
            }
        },
        
        // Générer un quiz adaptatif
        async generateAdaptiveQuiz(userId, subject, initialDifficulty = 'medium') {
            // Récupérer l'historique de l'utilisateur
            const userHistory = await this.getUserQuizHistory(userId, subject);
            const knowledgeGaps = EduConnectAI.AI_MEMORY.knowledgeGaps.get(userId)?.gaps || {};
            
            // Déterminer le niveau de difficulté adaptatif
            const adaptiveDifficulty = this.calculateAdaptiveDifficulty(userHistory, knowledgeGaps);
            
            // Identifier les sujets à travailler
            const topicsToFocus = this.identifyFocusTopics(knowledgeGaps, subject);
            
            // Générer le quiz adaptatif
            const quiz = await this.generateQuiz({
                subject: subject,
                level: 'adaptatif',
                topic: topicsToFocus[0] || subject,
                difficulty: adaptiveDifficulty,
                questionCount: 15,
                questionTypes: ['multiple-choice', 'true-false', 'short-answer']
            });
            
            // Ajouter des métadonnées adaptatives
            quiz.adaptiveMetadata = {
                userId: userId,
                basedOnHistory: userHistory.length,
                focusTopics: topicsToFocus,
                difficultyReason: this.getDifficultyReason(adaptiveDifficulty, userHistory),
                recommendations: await this.generateQuizRecommendations(userHistory)
            };
            
            return quiz;
        },
        
        // Calculer la difficulté adaptative
        calculateAdaptiveDifficulty(userHistory, knowledgeGaps) {
            if (userHistory.length === 0) return 'medium';
            
            const recentScores = userHistory
                .slice(-5) // 5 derniers quiz
                .map(q => q.score);
            
            const averageScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
            
            if (averageScore > 85) return 'hard';
            if (averageScore > 60) return 'medium';
            return 'easy';
        },
        
        // Identifier les sujets à travailler
        identifyFocusTopics(knowledgeGaps, subject) {
            const topics = [];
            
            for (const [topic, data] of Object.entries(knowledgeGaps)) {
                if (topic.includes(subject) && data.averageScore < 70) {
                    topics.push({
                        topic: topic.replace(`${subject}_`, ''),
                        score: data.averageScore,
                        priority: data.averageScore < 50 ? 'high' : 'medium'
                    });
                }
            }
            
            // Trier par priorité et score
            return topics
                .sort((a, b) => {
                    const priorityOrder = { high: 0, medium: 1, low: 2 };
                    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                        return priorityOrder[a.priority] - priorityOrder[b.priority];
                    }
                    return a.score - b.score;
                })
                .map(t => t.topic)
                .slice(0, 3); // Maximum 3 sujets
        },
        
        // Obtenir l'historique des quiz
        async getUserQuizHistory(userId, subject) {
            try {
                const history = JSON.parse(localStorage.getItem(`quiz_history_${userId}`) || '[]');
                return subject 
                    ? history.filter(q => q.subject === subject)
                    : history;
            } catch (error) {
                return [];
            }
        },
        
        // Obtenir la raison de la difficulté
        getDifficultyReason(difficulty, history) {
            const reasons = {
                easy: 'Bon pour commencer ou renforcer les bases',
                medium: 'Niveau adapté à tes compétences actuelles',
                hard: 'Défi pour progresser davantage'
            };
            
            return reasons[difficulty] || 'Niveau standard';
        },
        
        // Générer des recommandations après quiz
        async generateQuizRecommendations(history) {
            if (history.length === 0) return [];
            
            const lastQuiz = history[history.length - 1];
            const recommendations = [];
            
            if (lastQuiz.score < 50) {
                recommendations.push({
                    type: 'remediation',
                    action: 'Revoir les concepts de base',
                    resources: ['fiches_bases', 'vidéos_explicatives']
                });
            } else if (lastQuiz.score < 70) {
                recommendations.push({
                    type: 'practice',
                    action: 'S\'entraîner avec des exercices similaires',
                    resources: ['exercices_progressifs', 'quiz_entraînement']
                });
            } else {
                recommendations.push({
                    type: 'challenge',
                    action: 'Essayer des problèmes plus complexes',
                    resources: ['défis_avancés', 'problèmes_ouverts']
                });
            }
            
            // Recommandation basée sur le temps
            if (lastQuiz.timeSpent && lastQuiz.timeSpent < lastQuiz.timeLimit * 0.5) {
                recommendations.push({
                    type: 'speed',
                    action: 'Prendre plus de temps pour lire attentivement les questions',
                    tip: 'Relis chaque question deux fois avant de répondre'
                });
            }
            
            return recommendations;
        },
        
        // Générer un quiz de secours
        generateFallbackQuiz(options) {
            return {
                id: `fallback-quiz-${Date.now()}`,
                title: `Quiz ${options.topic}`,
                subject: options.subject,
                level: options.level,
                topic: options.topic,
                difficulty: options.difficulty,
                questions: [
                    {
                        id: "q1",
                        type: "multiple-choice",
                        question: "Question de base sur le sujet?",
                        options: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
                        correctAnswer: 0,
                        explanation: "Explication simple",
                        points: 10,
                        timeLimit: 60,
                        concept: "concept de base"
                    }
                ],
                passingScore: 70,
                timeLimit: 600,
                isAIGenerated: false,
                isFallback: true
            };
        },
        
        // Générer un quiz à partir d'un texte
        async generateQuizFromText(text, subject, options = {}) {
            const prompt = `À partir du texte suivant sur ${subject}, génère un quiz de 5 questions:
            
            TEXTE:
            ${text}
            
            Règles:
            1. Questions sur les points importants
            2. Varier les types de questions
            3. Inclure des questions de compréhension
            4. Une seule réponse correcte par question
            5. Ajouter des explications
            
            Format JSON comme précédemment.`;
            
            try {
                const response = await EduConnectAI.ContentGenerator.callAI(prompt);
                const quiz = JSON.parse(response);
                
                quiz.id = `text-quiz-${Date.now()}`;
                quiz.source = 'text';
                quiz.sourcePreview = text.substring(0, 100) + '...';
                
                return quiz;
            } catch (error) {
                console.error('Erreur génération quiz depuis texte:', error);
                return null;
            }
        }
    },
    
    // 🔍 SYSTÈME DE RECHERCHE SÉMANTIQUE
    SemanticSearch: {
        index: new Map(),
        
        // Indexer du contenu
        indexContent(content, metadata) {
            const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const indexedDoc = {
                id: id,
                content: content,
                metadata: metadata,
                embeddings: null,
                keywords: this.extractKeywords(content),
                timestamp: Date.now()
            };
            
            this.index.set(id, indexedDoc);
            return id;
        },
        
        // Extraire les mots-clés
        extractKeywords(text, maxKeywords = 10) {
            const words = text.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3);
            
            const stopWords = new Set([
                'dans', 'avec', 'pour', 'par', 'sur', 'sous', 'vers', 'chez',
                'dont', 'quoi', 'quand', 'que', 'qui', 'quel', 'quelle',
                'cest', 'cette', 'ces', 'ceux', 'celles', 'leur', 'leurs'
            ]);
            
            const frequency = {};
            words.forEach(word => {
                if (!stopWords.has(word)) {
                    frequency[word] = (frequency[word] || 0) + 1;
                }
            });
            
            return Object.entries(frequency)
                .sort((a, b) => b[1] - a[1])
                .slice(0, maxKeywords)
                .map(([word]) => word);
        },
        
        // Recherche sémantique
        async search(query, options = {}) {
            const {
                limit = 10,
                threshold = 0.3,
                useSemantic = true,
                filters = {}
            } = options;
            
            const results = [];
            const queryKeywords = this.extractKeywords(query);
            
            for (const [id, doc] of this.index.entries()) {
                // Appliquer les filtres
                if (filters.subject && doc.metadata.subject !== filters.subject) continue;
                if (filters.level && doc.metadata.level !== filters.level) continue;
                
                // Calculer le score
                let score = 0;
                
                // 1. Correspondance de mots-clés
                const keywordMatches = queryKeywords.filter(kw => 
                    doc.keywords.includes(kw)
                ).length;
                
                score += (keywordMatches / queryKeywords.length) * 0.6;
                
                // 2. Recherche sémantique (si activée et si embeddings disponibles)
                if (useSemantic && doc.embeddings) {
                    const semanticScore = await this.calculateSemanticSimilarity(query, doc);
                    score += semanticScore * 0.4;
                }
                
                // 3. Bonus pour le contenu récent
                const age = Date.now() - doc.timestamp;
                const recencyBonus = Math.max(0, 1 - (age / (30 * 24 * 60 * 60 * 1000))); // 30 jours
                score += recencyBonus * 0.1;
                
                if (score >= threshold) {
                    results.push({
                        id: id,
                        score: score,
                        document: doc,
                        highlights: this.highlightMatches(query, doc.content)
                    });
                }
            }
            
            // Trier par score
            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        },
        
        // Calculer la similarité sémantique
        async calculateSemanticSimilarity(query, document) {
            // En production, utiliser des embeddings réels
            // Ici, simulation avec correspondance de mots-clés améliorée
            
            const queryWords = new Set(query.toLowerCase().split(/\W+/).filter(w => w.length > 2));
            const docWords = new Set(document.content.toLowerCase().split(/\W+/).filter(w => w.length > 2));
            
            let intersection = 0;
            queryWords.forEach(word => {
                if (docWords.has(word)) intersection++;
            });
            
            return intersection / Math.max(queryWords.size, 1);
        },
        
        // Surligner les correspondances
        highlightMatches(query, content) {
            const keywords = this.extractKeywords(query, 5);
            let highlighted = content;
            
            keywords.forEach(keyword => {
                const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
                highlighted = highlighted.replace(regex, '<mark>$1</mark>');
            });
            
            // Extraire les passages pertinents
            const sentences = highlighted.split(/[.!?]+/);
            const relevantSentences = sentences.filter(sentence => 
                sentence.includes('<mark>')
            ).slice(0, 3);
            
            return relevantSentences.join('. ') + (relevantSentences.length > 0 ? '.' : '');
        },
        
        // Indexer tous les cours
        indexAllCourses(courses) {
            courses.forEach(course => {
                const contentToIndex = `
                    ${course.title}
                    ${course.description}
                    ${course.content}
                    ${course.tags.join(' ')}
                `;
                
                this.indexContent(contentToIndex, {
                    type: 'course',
                    subject: course.subject,
                    level: course.level,
                    courseId: course.id,
                    title: course.title
                });
            });
            
            console.log(`✅ ${courses.length} cours indexés pour la recherche`);
        },
        
        // Recherche intelligente avec suggestions
        async intelligentSearch(query, context = {}) {
            const searchResults = await this.search(query, {
                limit: 20,
                useSemantic: true,
                filters: context
            });
            
            // Générer des suggestions
            const suggestions = await this.generateSearchSuggestions(query, searchResults);
            
            // Classer par pertinence
            const categorizedResults = this.categorizeResults(searchResults);
            
            return {
                query: query,
                results: searchResults,
                suggestions: suggestions,
                categories: categorizedResults,
                total: searchResults.length,
                didYouMean: await this.suggestAlternativeQueries(query)
            };
        },
        
        // Générer des suggestions de recherche
        async generateSearchSuggestions(query, results) {
            const suggestions = [];
            
            // Suggérer des cours liés
            if (results.length > 0) {
                const topSubject = results[0].document.metadata.subject;
                suggestions.push({
                    type: 'related_courses',
                    title: `Cours similaires en ${topSubject}`,
                    query: `subject:${topSubject}`
                });
            }
            
            // Suggérer des quiz
            suggestions.push({
                type: 'quiz',
                title: 'Quiz sur ce sujet',
                query: `${query} quiz`,
                action: () => EduConnectAI.QuizGenerator.generateQuiz({
                    subject: 'general',
                    topic: query,
                    difficulty: 'medium'
                })
            });
            
            // Suggérer des fiches
            suggestions.push({
                type: 'summary',
                title: 'Fiche de révision',
                query: `${query} fiche`,
                action: () => EduConnectAI.ContentGenerator.generateSummarySheet(query)
            });
            
            return suggestions;
        },
        
        // Catégoriser les résultats
        categorizeResults(results) {
            const categories = {
                courses: [],
                exercises: [],
                definitions: [],
                examples: []
            };
            
            results.forEach(result => {
                const doc = result.document;
                
                if (doc.metadata.type === 'course') {
                    categories.courses.push(result);
                } else if (doc.content.includes('exercice') || doc.content.includes('problème')) {
                    categories.exercises.push(result);
                } else if (doc.content.includes('définit') || doc.content.includes('signifie')) {
                    categories.definitions.push(result);
                } else {
                    categories.examples.push(result);
                }
            });
            
            return categories;
        },
        
        // Suggérer des requêtes alternatives
        async suggestAlternativeQueries(query) {
            const prompt = `Pour la requête de recherche "${query}", suggère 3 variantes ou corrections:
            
            Format JSON:
            {
              "alternatives": [
                {"query": "variante 1", "reason": "orthographe alternative"},
                {"query": "variante 2", "reason": "terme plus précis"},
                {"query": "variante 3", "reason": "synonyme courant"}
              ]
            }`;
            
            try {
                const response = await EduConnectAI.ContentGenerator.callAI(prompt);
                return JSON.parse(response).alternatives;
            } catch (error) {
                return [];
            }
        }
    },
    
    // ==================== INITIALISATION ET INTERFACE ====================
    
    // Initialiser l'interface IA
    initAIInterface: function() {
        console.log('🤖 Initialisation de l\'interface IA...');
        
        // Configurer l'API Key si disponible
        this.setupAPIKeyInput();
        
        // Initialiser la recherche sémantique
        this.SemanticSearch.indexAllCourses(this.DEMO_DATA.courses);
        
        // Configurer les écouteurs IA
        this.setupAIEventListeners();
        
        // Démarrer le tuteur IA
        this.startAITutorService();
        
        console.log('✅ Interface IA initialisée');
    },
    
    // Configurer l'input pour l'API Key
    setupAPIKeyInput: function() {
        const apiKey = localStorage.getItem('openai_api_key');
        if (apiKey) {
            this.AI_CONFIG.API_KEY = apiKey;
        } else {
            // Demander l'API Key au premier lancement
            setTimeout(() => {
                this.showAPIKeyModal();
            }, 3000);
        }
    },
    
    // Afficher le modal pour l'API Key
    showAPIKeyModal: function() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔑 Configuration de l'IA</h3>
                </div>
                <div class="modal-body">
                    <p>Pour utiliser les fonctionnalités IA avancées, entre ta clé API OpenAI :</p>
                    <div class="form-group">
                        <input type="password" id="api-key-input" placeholder="sk-..." class="form-control">
                        <small class="text-muted">
                            <a href="https://platform.openai.com/api-keys" target="_blank">
                                Obtenir une clé API sur OpenAI
                            </a>
                        </small>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="EduConnectAI.hideAPIKeyModal()">
                            Plus tard
                        </button>
                        <button class="btn btn-primary" onclick="EduConnectAI.saveAPIKey()">
                            Enregistrer
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },
    
    // Cacher le modal
    hideAPIKeyModal: function() {
        const modal = document.querySelector('.modal');
        if (modal) modal.remove();
    },
    
    // Sauvegarder l'API Key
    saveAPIKey: function() {
        const input = document.getElementById('api-key-input');
        if (input && input.value.trim()) {
            const apiKey = input.value.trim();
            localStorage.setItem('openai_api_key', apiKey);
            this.AI_CONFIG.API_KEY = apiKey;
            this.hideAPIKeyModal();
            this.showToast('Clé API enregistrée !', 'success');
        }
    },
    
    // Configurer les écouteurs IA
    setupAIEventListeners: function() {
        // Recherche intelligente
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.addEventListener('keyup', debounce(async (e) => {
                if (e.target.value.length > 2) {
                    const results = await this.SemanticSearch.intelligentSearch(e.target.value);
                    this.displaySearchResults(results);
                }
            }, 500));
        }
        
        // Bouton de génération de cours
        const generateCourseBtn = document.getElementById('generate-course-btn');
        if (generateCourseBtn) {
            generateCourseBtn.addEventListener('click', async () => {
                const subject = prompt('Matière :');
                const topic = prompt('Sujet :');
                if (subject && topic) {
                    const course = await this.ContentGenerator.generateCourse(subject, '4e', topic);
                    this.displayGeneratedCourse(course);
                }
            });
        }
        
        // Chat avec le tuteur IA
        const tutorChatInput = document.getElementById('tutor-chat-input');
        const tutorSendBtn = document.getElementById('tutor-send-btn');
        
        if (tutorChatInput && tutorSendBtn) {
            tutorSendBtn.addEventListener('click', async () => {
                const question = tutorChatInput.value.trim();
                if (question) {
                    await this.handleTutorQuestion(question);
                    tutorChatInput.value = '';
                }
            });
            
            tutorChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    tutorSendBtn.click();
                }
            });
        }
    },
    
    // Afficher les résultats de recherche
    displaySearchResults: function(results) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;
        
        let html = `
            <div class="search-results-header">
                <h4>${results.total} résultats pour "${results.query}"</h4>
                ${results.didYouMean.length > 0 ? `
                    <div class="did-you-mean">
                        Vouliez-vous dire: 
                        ${results.didYouMean.map(alt => 
                            `<a href="#" onclick="EduConnectAI.search('${alt.query}')">${alt.query}</a>`
                        ).join(', ')}
                    </div>
                ` : ''}
            </div>
        `;
        
        if (results.results.length > 0) {
            html += '<div class="results-grid">';
            
            results.results.slice(0, 5).forEach(result => {
                html += `
                    <div class="result-card">
                        <div class="result-score">${Math.round(result.score * 100)}%</div>
                        <h5>${result.document.metadata.title || 'Document'}</h5>
                        <p class="result-preview">${result.highlights || result.document.content.substring(0, 150)}...</p>
                        <div class="result-meta">
                            <span class="badge">${result.document.metadata.subject}</span>
                            <span class="badge">${result.document.metadata.level}</span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            
            // Suggestions
            if (results.suggestions.length > 0) {
                html += `
                    <div class="search-suggestions">
                        <h5>Suggestions :</h5>
                        <div class="suggestions-list">
                            ${results.suggestions.map(suggestion => `
                                <button class="suggestion-btn" onclick="${suggestion.action ? suggestion.action.toString() : `EduConnectAI.search('${suggestion.query}')`}">
                                    ${suggestion.title}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        } else {
            html += `
                <div class="no-results">
                    <p>Aucun résultat trouvé. Essayez une autre recherche ou :</p>
                    <button class="btn btn-primary" onclick="EduConnectAI.AITutor.startSession('user', null, '${results.query}')">
                        Demander au tuteur IA
                    </button>
                </div>
            `;
        }
        
        resultsContainer.innerHTML = html;
        resultsContainer.style.display = 'block';
    },
    
    // Afficher un cours généré
    displayGeneratedCourse: function(course) {
        const container = document.getElementById('generated-content');
        if (!container) return;
        
        container.innerHTML = `
            <div class="generated-course">
                <div class="course-header">
                    <h3>${course.title} 🤖</h3>
                    <div class="course-meta">
                        <span class="badge">IA Généré</span>
                        <span class="badge">${course.difficulty}</span>
                        <span class="badge">${course.duration}</span>
                    </div>
                </div>
                
                <div class="course-objectives">
                    <h4>Objectifs :</h4>
                    <ul>
                        ${course.objectives.map(obj => `<li>${obj}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="course-content">
                    ${course.formattedContent || course.content}
                </div>
                
                <div class="course-actions">
                    <button class="btn btn-primary" onclick="EduConnectAI.QuizGenerator.generateQuiz({
                        subject: '${course.subject}',
                        topic: '${course.topic}',
                        difficulty: '${course.difficulty}'
                    }).then(quiz => EduConnectAI.displayGeneratedQuiz(quiz))">
                        Générer un quiz
                    </button>
                    <button class="btn btn-secondary" onclick="EduConnectAI.downloadCourse('${course.id}')">
                        Télécharger
                    </button>
                </div>
            </div>
        `;
    },
    
    // Gérer une question pour le tuteur
    async handleTutorQuestion(question) {
        const chatContainer = document.getElementById('tutor-chat');
        if (!chatContainer) return;
        
        // Afficher la question de l'utilisateur
        chatContainer.innerHTML += `
            <div class="chat-message user-message">
                <div class="message-content">${question}</div>
            </div>
        `;
        
        // Obtenir la réponse du tuteur
        const response = await this.AITutor.answerQuestion(question);
        
        // Afficher la réponse
        chatContainer.innerHTML += `
            <div class="chat-message assistant-message">
                <div class="message-content">${response}</div>
            </div>
        `;
        
        // Scroll vers le bas
        chatContainer.scrollTop = chatContainer.scrollHeight;
    },
    
    // Démarrer le service de tuteur IA
    startAITutorService: function() {
        // Vérifier périodiquement si l'utilisateur a besoin d'aide
        setInterval(() => {
            this.checkForHelpNeeded();
        }, 300000); // Toutes les 5 minutes
    },
    
    // Vérifier si l'utilisateur a besoin d'aide
    checkForHelpNeeded: function() {
        const recentActivity = this.getRecentActivity();
        
        // Détecter les signes de difficulté
        if (recentActivity.quizAttempts > 0 && recentActivity.averageScore < 50) {
            this.showHelpNotification();
        }
    },
    
    // Obtenir l'activité récente
    getRecentActivity: function() {
        return {
            quizAttempts: 0,
            averageScore: 0,
            timeSpent: 0,
            difficulties: []
        };
    },
    
    // Afficher une notification d'aide
    showHelpNotification: function() {
        this.showToast('Besoin d\'aide ? Le tuteur IA est disponible !', 'info', {
            action: () => this.AITutor.startSession('user'),
            actionText: 'Parler au tuteur'
        });
    },
    
    // ==================== UTILITAIRES ====================
    
    // Afficher une notification
    showToast: function(message, type = 'info', options = {}) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                ${this.getToastIcon(type)}
            </div>
            <div class="toast-content">
                <h4>${this.getToastTitle(type)}</h4>
                <p>${message}</p>
            </div>
            ${options.action ? `
                <button class="toast-action" onclick="${options.action}">
                    ${options.actionText || 'Action'}
                </button>
            ` : ''}
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        const container = document.getElementById('toast-container') || (() => {
            const div = document.createElement('div');
            div.id = 'toast-container';
            document.body.appendChild(div);
            return div;
        })();
        
        container.appendChild(toast);
        
        // Auto-suppression après 5 secondes
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    },
    
    getToastIcon: function(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || '💡';
    },
    
    getToastTitle: function(type) {
        const titles = {
            success: 'Succès',
            error: 'Erreur',
            warning: 'Attention',
            info: 'Information'
        };
        return titles[type] || 'Notification';
    }
};

// ==================== FONCTIONS UTILITAIRES GLOBALES ====================

// Debounce pour les événements
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Formater la date
function formatDate(date) {
    return new Date(date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Générer un ID unique
function generateId(prefix = '') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== INITIALISATION AU CHARGEMENT ====================

document.addEventListener('DOMContentLoaded', () => {
    // Initialiser le système IA
    EduConnectAI.initAIInterface();
    
    // Ajouter des styles pour l'interface IA
    const style = document.createElement('style');
    style.textContent = `
        .chat-message {
            margin: 10px;
            padding: 12px;
            border-radius: 10px;
            max-width: 80%;
        }
        
        .user-message {
            background: #e3f2fd;
            margin-left: auto;
        }
        
        .assistant-message {
            background: #f5f5f5;
            margin-right: auto;
        }
        
        .search-results {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 1000;
            display: none;
        }
        
        .result-card {
            padding: 15px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
        }
        
        .result-card:hover {
            background: #f9f9f9;
        }
        
        .result-score {
            position: absolute;
            right: 15px;
            top: 15px;
            background: #4CAF50;
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
        }
        
        .ai-badge {
            background: linear-gradient(45deg, #FF6B6B, #4ECDC4);
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 8px;
        }
    `;
    document.head.appendChild(style);
    
    console.log('🚀 ÉDUC-BIN IA est prêt !');
});

// ==================== EXPORT POUR USAGE GLOBAL ====================
window.EduConnectAI = EduConnectAI;
window.AITutor = EduConnectAI.AITutor;
window.QuizGenerator = EduConnectAI.QuizGenerator;
window.ContentGenerator = EduConnectAI.ContentGenerator;
window.SemanticSearch = EduConnectAI.SemanticSearch;

// Exemple d'utilisation :
// 1. Générer un cours : EduConnectAI.ContentGenerator.generateCourse('maths', '4e', 'fractions')
// 2. Créer un quiz : EduConnectAI.QuizGenerator.generateQuiz({subject: 'maths', topic: 'fractions'})
// 3. Parler au tuteur : EduConnectAI.AITutor.startSession('userId')
// 4. Recherche : EduConnectAI.SemanticSearch.search('fractions')
