const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async (req, res) => {
    // Сразу отвечаем Telegram, что запрос принят, чтобы он не слал повторные запросы
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

        // Проверяем, оставил ли пользователь номер телефона (7 или более цифр)
        const digits = text.replace(/\D/g, '');
        if (digits.length >= 7) {
            
            // 1. ОТПРАВЛЯЕМ СКРЫТНУЮ ЗАЯВКУ ВАМ (АДМИНИСТРАТОРУ)
            // Робот берет ваш ID из переменной MY_TELEGRAM_ID в Vercel
            if (process.env.MY_TELEGRAM_ID) {
                await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: process.env.MY_TELEGRAM_ID,
                        text: `🚗 *Новая заявка на АРЕНДУ АВТО!*\n📱 *Телефон клиента:* +${digits}`,
                        parse_mode: 'Markdown'
                    })
                });
            }

            // 2. ОТВЕЧАЕМ КЛИЕНТУ В ЧАТ БОТА
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

        // РАБОТА С ИИ GEMINI
        const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const systemInstruction = `Ты — опытный, вежливый и дружелюбный менеджер по прокату автомобилей в Кемере. 
Твоя главная цель — помочь клиенту выбрать машину и взять его номер телефона для WhatsApp, чтобы передать его старшему менеджеру.
Цены у нас гибкие, зависят от сезона и срока аренды. Отвечай коротко, не пиши огромные тексты. 
Когда пользователь готов оставить телефон или пишет его, вежливо поблагодари его.`;

        const prompt = `${systemInstruction}\n\nПользователь пишет: ${text}`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // ОТПРАВЛЯЕМ ОТВЕТ ОТ ИИ КЛИЕНТУ
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: responseText,
                parse_mode: 'Markdown' // Делает текст ИИ красивым, скрывая звездочки разметки **
            })
        });

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Ошибка в коде:', error);
        // Возвращаем 200, чтобы Telegram не мучал сервер повторами при ошибках
        return res.status(200).send('OK');
    }
};
