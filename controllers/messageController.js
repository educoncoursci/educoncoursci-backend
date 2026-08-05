// ============================================================
//  controllers/messageController.js
//  Lot 15 — Messagerie privée entre candidats (connecté requis
//  pour toutes les routes).
// ============================================================

const Message = require("../models/Message");
const User = require("../models/User");

// ════════════════════════════════════════════════════════════
//  GET /api/messages/conversations — Mes conversations
// ════════════════════════════════════════════════════════════
exports.listerConversations = async (req, res) => {
  try {
    const conversations = await Message.listerConversations(req.user.id);
    res.json({ total: conversations.length, conversations });
  } catch (err) {
    console.error("Erreur liste conversations :", err.message);
    res.status(500).json({ error: "Erreur lors du chargement de tes messages." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/messages/conversations — Démarrer/ouvrir une conversation
//  Body : { destinataireId }
// ════════════════════════════════════════════════════════════
exports.demarrerConversation = async (req, res) => {
  try {
    const { destinataireId } = req.body;
    if (!destinataireId) {
      return res.status(400).json({ error: "destinataireId est requis." });
    }
    if (parseInt(destinataireId, 10) === req.user.id) {
      return res.status(400).json({ error: "Tu ne peux pas t'envoyer un message à toi-même." });
    }
    const destinataire = await User.findById(destinataireId);
    if (!destinataire) {
      return res.status(404).json({ error: "Destinataire introuvable." });
    }

    const conversation = await Message.trouverOuCreerConversation(req.user.id, parseInt(destinataireId, 10));
    res.status(201).json({ conversation, destinataireNom: destinataire.nom });
  } catch (err) {
    console.error("Erreur démarrage conversation :", err.message);
    res.status(500).json({ error: "Erreur lors de l'ouverture de la conversation." });
  }
};

// ════════════════════════════════════════════════════════════
//  GET /api/messages/conversations/:id — Messages d'une conversation
// ════════════════════════════════════════════════════════════
exports.detailConversation = async (req, res) => {
  try {
    const conversation = await Message.findConversationById(req.params.id);
    if (!conversation || (conversation.user1_id !== req.user.id && conversation.user2_id !== req.user.id)) {
      return res.status(404).json({ error: "Conversation introuvable." });
    }

    const messages = await Message.listerMessages(req.params.id);
    await Message.marquerLus(req.params.id, req.user.id);

    const autreId = conversation.user1_id === req.user.id ? conversation.user2_id : conversation.user1_id;
    const autre = await User.findById(autreId);

    res.json({ conversation, messages, autre: { id: autre?.id, nom: autre?.nom } });
  } catch (err) {
    console.error("Erreur détail conversation :", err.message);
    res.status(500).json({ error: "Erreur lors du chargement de la conversation." });
  }
};

// ════════════════════════════════════════════════════════════
//  POST /api/messages/conversations/:id/messages — Envoyer un message
// ════════════════════════════════════════════════════════════
exports.envoyerMessage = async (req, res) => {
  try {
    const conversation = await Message.findConversationById(req.params.id);
    if (!conversation || (conversation.user1_id !== req.user.id && conversation.user2_id !== req.user.id)) {
      return res.status(404).json({ error: "Conversation introuvable." });
    }

    const { contenu } = req.body;
    if (!contenu || contenu.trim().length < 1) {
      return res.status(400).json({ error: "Le message ne peut pas être vide." });
    }
    if (contenu.length > 2000) {
      return res.status(400).json({ error: "Message trop long (2000 caractères max)." });
    }

    const message = await Message.envoyerMessage(req.params.id, req.user.id, contenu.trim());
    res.status(201).json({ message: { ...message, expediteur_nom: req.user.nom } });
  } catch (err) {
    console.error("Erreur envoi message :", err.message);
    res.status(500).json({ error: "Erreur lors de l'envoi du message." });
  }
};

// ════════════════════════════════════════════════════════════
//  GET /api/messages/non-lus — Nombre de messages non lus
// ════════════════════════════════════════════════════════════
exports.compterNonLus = async (req, res) => {
  try {
    const total = await Message.compterNonLus(req.user.id);
    res.json({ total });
  } catch (err) {
    console.error("Erreur compteur messages non lus :", err.message);
    res.status(500).json({ error: "Erreur serveur." });
  }
};
