const { GoogleGenAI } = require('@google/generative-ai');

module.exports = async (req, res) => {
    // Сразу отвечаем Telegram, что запрос принят
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

        // Проверяем, оставил ли пользователь номер телефона
        const digits = text.replace(/\D/g, '');
        if (digits.length >= 7) {
            // 1. Отправляем скрытную заявку ВАМ (администратору)
            if (process.env.MY_TELEGRAM_ID) {
                await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: process.env.MY_TELEGRAM_ID,
                        text: `🚗 *Новая заявка на АРЕНДУ АВТО!*\n📱 Телефон клиента: +${digits}`,
                        parse_mode: 'Markdown'
                    })
                });
            }

            // 2. Отвечаем клиенту в чат бота
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

        // Правильное подключение ИИ Gemini для Vercel
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const systemInstruction = `Ты — опытный, вежливый и дружелюбный менеджер по прокату автомобилей в Кемере. 
Твоя главная цель — помочь клиенту выбрать машину и взять его номер телефона для WhatsApp.
Цены у нас гибкие. Отвечай коротко, не пиши огромные тексты.`;

        const prompt = `${systemInstruction}\n\nПользователь пишет: ${text}`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Отправляем ответ ИИ обратно клиенту
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: responseText,
                parse_mode: 'Markdown'
            })
        });

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Ошибка в коде:', error);
        // Не даем серверу упасть, всегда возвращаем 200
        return res.status(200).send('OK');
    }
};
