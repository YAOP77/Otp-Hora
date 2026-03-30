const userContactsService = require('./userContacts.service');

async function createContact(req, res, next) {
  try {
    const contact = await userContactsService.createContact({
      user_id: req.body?.user_id,
      phone_number: req.body?.phone_number,
    });

    return res.status(201).json({
      data: contact,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createContact,
};
