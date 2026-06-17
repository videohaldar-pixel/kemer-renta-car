const { GoogleGenAI } = require('@google/generative-ai');

const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);
const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

const systemInstruction = `Ты — опытный, вежливый и дружелюбный менеджер по прокату автомобилей в Кемере. 
Твоя главная цель — помочь клиенту выбрать машину и взять его номер телефона для WhatsApp, чтобы передать его старшему менеджеру.
Цены у нас гибкие, зависят от сезона и срока. Отвечай коротко, не пиши огромные тексты. Когда пользователь готов оставить телефон или пишет его, поблагодари его.`;

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send('OK');
    }

    try {
        const { message } = req.body;
        if (!message || !message.text) {
            return res.status(200).send('OK');
        }

        const chatId = message.chat.id;
        const text = message.text.trim();

        // Простая проверка на номер телефона (если в тексте больше 7 цифр)
        const digits = text.replace(/\D/g, '');
        if (digits.length >= 7) {
            // 1. Отправляем скрытную заявку ВАМ (администратору)
            if (process.env.MY_TELEGRAM_ID) {
                await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: process.env.MY_TELEGRAM_ID, // Уходит строго вам
                        text: `🚗 *Новая заявка на АРЕНДУ АВТО!*\n📱 Телефон клиента: +${digits}`,
                        parse_mode: 'Markdown'
                    })
                });
            }

            // 2. Отвечаем клиенту в чат
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: 'Отлично! Благодарю вас за номер! Наш менеджер уже связывается с вами в WhatsApp для подбора лучшего варианта. Комфортных дорог!'
                })
            });

            return res.status(200).send('OK');
        }

        // Если это обычный текст — отвечает ИИ Gemini
        const chat = model.startChat({
            history: [],
            generationConfig: { maxOutputTokens: 300 }
        });

        const prompt = `${systemInstruction}\n\nПользователь пишет: ${text}`;
        const result = await chat.sendMessage(prompt);
        const responseText = result.response.text();

        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: responseText,
                parse_mode: 'Markdown' // Делает текст красивым (жирный, курсив)
            })
        });

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Ошибка:', error);
        return res.status(200).send('OK');
    }
};
