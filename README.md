# ShoppyAI – AI Shopping Recovery Agent

ShoppyAI is an AI-powered shopping recovery agent that intelligently re-engages users who repeatedly view or abandon products in an online marketplace.

Instead of sending generic reminder emails, ShoppyAI analyzes shopping behavior, prioritizes products based on user interest, and delivers personalized WhatsApp reminders with product images to encourage users to complete their purchase.

---

## Features

- Simulated AI-powered shopping marketplace
- User behavior tracking (views, cart additions)
- Interest scoring and reminder planning
- Personalized reminder message generation
- WhatsApp notifications using Twilio
- Product image delivery in WhatsApp
- Modular agent architecture for future AI capabilities

---

## Demo Flow

1. User browses products.
2. User repeatedly views or adds products to cart.
3. ShoppyAI tracks shopping behavior.
4. Interest score crosses a threshold.
5. AI generates a contextual reminder.
6. Reminder is delivered via WhatsApp with the product image.

---

## Architecture

```
Marketplace
      │
      ▼
Interest Tracker Agent
      │
      ▼
Reminder Planner Agent
      │
      ▼
Message Generator
      │
      ▼
Notification Service
      │
      ▼
Twilio WhatsApp API
      │
      ▼
User receives personalized reminder
```

---

## Tech Stack

### Backend
- Node.js
- Express.js
- JavaScript

### Messaging
- Twilio WhatsApp API

### Database
- SQLite

### Development
- ngrok
- Git
- GitHub

---

## Project Structure

```
src/
 ├── application/
 ├── domain/
 ├── infrastructure/
 ├── demo/
 ├── public/
 └── server.js
```

---

## Why ShoppyAI?

Traditional abandoned-cart reminders are generic and often ignored.

ShoppyAI acts as an intelligent shopping companion by:

- Understanding user shopping intent.
- Sending reminders at the right time.
- Delivering rich WhatsApp notifications instead of generic emails.
- Creating a more engaging shopping experience.

---

## Future Roadmap

- AI-powered virtual try-on
- Price drop alerts
- Wishlist intelligence
- Personalized fashion recommendations
- Conversational shopping assistant
- Merchant analytics dashboard

---

## Getting Started

Clone the repository:

```bash
git clone https://github.com/urgetolearn/ShoppyAI.git
```

Install dependencies:

```bash
npm install
```

Start the application:

```bash
npm run ui
```

---

## Demo

- **Live Demo:** *(Add your ngrok or deployment URL here)*
- **Demo Video:** *(Add your Loom or YouTube link here)*

---

## Author

**Chinmayi D S**

National Institute of Technology Surathkal

GitHub: https://github.com/urgetolearn

---

## License

This project was built for the **AI Agent Builder Series 2026** Hackathon.
