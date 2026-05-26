const Lead = require('../models/Lead');

const getLeads = async (req, res) => {
  try {
    const leads = await Lead.find().sort({ createdAt: -1 }).populate('assignedTo', 'firstName lastName email');
    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leads', error: error.message });
  }
};

const createLead = async (req, res) => {
  try {
    const lead = await Lead.create(req.body);
    res.status(201).json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.status(200).json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteLead = async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const lead = await Lead.findByIdAndUpdate(id, { status }, { new: true });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    
    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Error updating lead', error: error.message });
  }
};

const addNoteToLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    
    lead.notes.push({
      content,
      addedBy: req.user.id // Requires auth middleware
    });
    
    await lead.save();
    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Error adding note', error: error.message });
  }
};

const assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { advisorId } = req.body;
    
    const lead = await Lead.findByIdAndUpdate(id, { assignedTo: advisorId }, { new: true });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    
    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Error assigning lead', error: error.message });
  }
};

module.exports = {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  updateLeadStatus,
  addNoteToLead,
  assignLead
};
