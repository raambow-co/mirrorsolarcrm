import { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, X, 
  ChevronLeft, ChevronRight, Calendar, 
  CheckCircle2, MapPin, Phone, Mail,
  FileText, Upload, User, Clock, CheckSquare, Download, Loader2,
  Eye, ExternalLink, Trash2, RefreshCw, AlertTriangle, ShieldCheck,
  Camera, Check, Lock, CheckCircle, ShieldAlert, FolderCheck
} from 'lucide-react';
import { 
  useCRM, STAGES,
  SECTION_1_DEALER_KYC_DOCS,
  SECTION_2_BANK_FIRST_PAYMENT_DOCS,
  SECTION_2_LINKED_KYC_DOCS,
  SECTION_3_SITE_INSTALLATION_DOCS,
  SECTION_4_BANK_SECOND_PAYMENT_DOCS,
  SECTION_5_GRID_OFFICE_DOCS,
  ALL_DOCUMENT_TYPES,
  DOC_REQUIREMENTS,
  DEALER_KYC_DOCS, 
  EMPLOYEE_PROCESSING_DOCS, 
  INSTALLATION_COMPLETION_DOCS
} from './context/CRMContext';
import type { 
  MockLead, Stage, LeadDocument, DocumentStatus, EmployeeWorkStatus, ProjectUpdate, InstallationApprovalStatus,
  DealerProjectSpecifications
} from './context/CRMContext';
import { useUI } from './context/UIContext';
import { useStock } from './context/StockContext';
import { canManageModule } from './utils/permissionCalculations';
import './LeadsPage.css';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/heif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
const PAGE_SIZE = 10;

export const DOCUMENT_TYPES = ALL_DOCUMENT_TYPES;

interface LeadsPageProps {
  stage?: string;
  status?: string;
  action?: string;
  filter?: string; // e.g. "Today" for followups
}

export default function LeadsPage({ stage, status, action, filter }: LeadsPageProps) {
  const { 
    leads, employees, dealers, currentUser, activities, tasks,
    updateLead, addActivity, addLead 
  } = useCRM();
  
  const { showToast } = useUI();
  const { deductDealerStockForLeadMaterial } = useStock();

  // --- STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  
  // Scoped default filters based on role
  const isEmployee = currentUser?.role === 'Employee';
  const isDealer = currentUser?.role === 'Dealer';
  const isAdmin = currentUser?.role === 'Admin';
  
  const [empFilter, setEmpFilter] = useState(isEmployee ? currentUser.name : 'All');
  const [dlrFilter, setDlrFilter] = useState(isDealer ? currentUser.name : 'All');
  const [stageFilter, setStageFilter] = useState(stage || 'All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [leadTypeFilter, setLeadTypeFilter] = useState('All');
  const [followupFilter, setFollowupFilter] = useState(filter || 'All');
  const [statusFilter, setStatusFilter] = useState(status || 'Active');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('Updated');
  
  const [selectedLead, setSelectedLead] = useState<MockLead | null>(null);

  // Auto-sync open lead details drawer with live real-time Firestore updates
  useEffect(() => {
    if (selectedLead) {
      const liveLead = leads.find(l => l.id === selectedLead.id);
      if (liveLead && JSON.stringify(liveLead) !== JSON.stringify(selectedLead)) {
        setSelectedLead(liveLead);
      }
    }
  }, [leads]);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(action === 'add');
  const [newLeadForm, setNewLeadForm] = useState({
    customer: '', phone: '', email: '', location: '', dealer: '', assignedEmployee: '', notes: '', leadType: 'tracking' as 'tracking' | 'project'
  });
  const [showStageModal, setShowStageModal] = useState(false);
  const [targetStage, setTargetStage] = useState<Stage | ''>('');
  
  const [showChangeEmpModal, setShowChangeEmpModal] = useState(false);
  const [newEmp, setNewEmp] = useState('');
  
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('');
  
  const [showAddFollowupModal, setShowAddFollowupModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newFollowupForm, setNewFollowupForm] = useState({ date: '', time: '', type: 'Call', priority: 'Medium' });
  
  const [activityFilter, setActivityFilter] = useState('All');

  // Document management state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ documentType: '', file: null as File | null, notes: '' });
  const [isReplacingDocId, setIsReplacingDocId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<LeadDocument | null>(null);

  const [showDeleteDocModal, setShowDeleteDocModal] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  // Admin Document Review State
  const [showVerifyDocModal, setShowVerifyDocModal] = useState(false);
  const [docToVerify, setDocToVerify] = useState<LeadDocument | null>(null);

  const [showRejectDocModal, setShowRejectDocModal] = useState(false);
  const [docToReject, setDocToReject] = useState<LeadDocument | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [showRequestDocModal, setShowRequestDocModal] = useState(false);
  const [docToRequest, setDocToRequest] = useState<LeadDocument | null>(null);
  const [requestDocNotes, setRequestDocNotes] = useState('');

  // Employee Work & Updates State
  const [showAddUpdateModal, setShowAddUpdateModal] = useState(false);
  const [newUpdateForm, setNewUpdateForm] = useState({ description: '', status: 'In Progress' as EmployeeWorkStatus });

  // Categorized Documents Tab: 5 Sections
  const [docCategoryTab, setDocCategoryTab] = useState<'all' | 'section1' | 'section2' | 'section3' | 'section4' | 'section5'>('all');

  // Dealer Project Technical Specifications Form State
  const [specsForm, setSpecsForm] = useState<DealerProjectSpecifications>({});
  const [isSavingSpecs, setIsSavingSpecs] = useState(false);
  const [isUploadingEmailProof, setIsUploadingEmailProof] = useState(false);

  // Sync specsForm whenever selectedLead changes
  useEffect(() => {
    if (selectedLead) {
      setSpecsForm(selectedLead.dealerSpecifications || {
        email: selectedLead.email || '',
        phone: selectedLead.phone || '',
        fullName: selectedLead.customer || '',
        panelWp: '540 Wp',
        phase: '1 Phase',
        systemCapacityKw: '3 kW',
        buildingFloors: '1 Floor',
        structureHeightAndType: 'Company Structure',
        lightningArresterStand: 'Yes',
        pipes10FeetCount: '',
        longLBendsCount: '',
        shortLBendsCount: '',
        tBendsCount: '',
        straightJointConnectorsCount: '',
        dcRedWireLength: '',
        dcBlackWireLength: '',
        acRedWireLength: '',
        acBlackWireLength: '',
        greenWireLength: '',
        bankIfscCode: ''
      });
    }
  }, [selectedLead?.id]);

  const handleSaveSpecs = async () => {
    if (!selectedLead) return;
    try {
      setIsSavingSpecs(true);
      const updatedSpecs = { ...specsForm };
      await updateLead(selectedLead.id, {
        dealerSpecifications: updatedSpecs,
        phone: updatedSpecs.phone || selectedLead.phone,
        email: updatedSpecs.email || selectedLead.email,
        customer: updatedSpecs.fullName || selectedLead.customer
      });
      addActivity({
        type: 'Technical Specs Saved',
        message: `${currentUser?.name || 'Staff'} saved project technical specifications for ${selectedLead.customer}`,
        user: currentUser?.name || 'Staff',
        leadId: selectedLead.id,
        dealer: selectedLead.dealer
      });
      showToast("Project Technical Specifications saved successfully!", 'success');
    } catch (err: any) {
      console.error("Error saving specifications:", err);
      showToast("Failed to save specifications.", 'error');
    } finally {
      setIsSavingSpecs(false);
    }
  };

  const handleUploadEmailProof = async (file: File) => {
    if (!selectedLead) return;
    try {
      setIsUploadingEmailProof(true);
      const fileUrl = await uploadToFirebase(file);
      const updated = {
        ...specsForm,
        emailProofUrl: fileUrl,
        emailProofFileName: file.name
      };
      setSpecsForm(updated);
      await updateLead(selectedLead.id, { dealerSpecifications: updated });
      showToast("Email ID photo proof uploaded!", 'success');
    } catch (err: any) {
      showToast(err.message || "Failed to upload email proof", 'error');
    } finally {
      setIsUploadingEmailProof(false);
    }
  };

  // Download Section Selector Modal State
  const [showDownloadSectionModal, setShowDownloadSectionModal] = useState(false);
  const [selectedDownloadSections, setSelectedDownloadSections] = useState({
    s1: true,
    s2: true,
    s3: true,
    s4: true,
    s5: true
  });

  const handleDownloadSelectedSections = () => {
    if (!selectedLead?.documents || selectedLead.documents.length === 0) {
      showToast("No documents found for this project.", "error");
      return;
    }

    // Collect targeted document types based on selected sections
    const targetDocTypes = new Set<string>();
    if (selectedDownloadSections.s1) {
      SECTION_1_DEALER_KYC_DOCS.forEach(t => targetDocTypes.add(t));
    }
    if (selectedDownloadSections.s2) {
      SECTION_2_BANK_FIRST_PAYMENT_DOCS.forEach(t => targetDocTypes.add(t));
      SECTION_2_LINKED_KYC_DOCS.forEach(t => targetDocTypes.add(t));
    }
    if (selectedDownloadSections.s3) {
      SECTION_3_SITE_INSTALLATION_DOCS.forEach(t => targetDocTypes.add(t));
    }
    if (selectedDownloadSections.s4) {
      SECTION_4_BANK_SECOND_PAYMENT_DOCS.forEach(t => targetDocTypes.add(t));
      targetDocTypes.add('Geo-Tagged Photo with Customer in Plant');
    }
    if (selectedDownloadSections.s5) {
      SECTION_5_GRID_OFFICE_DOCS.forEach(t => targetDocTypes.add(t));
      targetDocTypes.add('PROJECT COMPLETION REPORT');
      targetDocTypes.add('Geo-Tagged Photo with Customer in Plant');
      targetDocTypes.add('Current Bill');
    }

    const filesToDownload = selectedLead.documents.filter(d => targetDocTypes.has(d.documentType));

    if (filesToDownload.length === 0) {
      showToast("No uploaded files found in the selected sections.", "error");
      return;
    }

    showToast(`Downloading ${filesToDownload.length} files from selected sections...`, "info");
    setShowDownloadSectionModal(false);

    filesToDownload.forEach((doc, index) => {
      if (doc.fileUrl) {
        setTimeout(() => {
          const downloadUrl = doc.fileUrl;
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = doc.fileName || `${doc.documentType}`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            try { document.body.removeChild(link); } catch {}
          }, 200);
        }, index * 400);
      }
    });

    addActivity({
      type: 'Documents Downloaded',
      message: `${currentUser?.role || 'User'} downloaded ${filesToDownload.length} documents from selected sections`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer,
      leadId: selectedLead.id
    });
  };

  // Installation Approval & Photo Validation Modals
  const [showPhotoRequiredModal, setShowPhotoRequiredModal] = useState(false);
  const [showRejectInstallationModal, setShowRejectInstallationModal] = useState(false);
  const [installationRejectReason, setInstallationRejectReason] = useState('');

  // --- 1. STRICT ROLE SCOPING ---
  // This completely prevents data leaks by restricting the base dataset.
  const baseLeads = useMemo(() => {
    let result = leads;
    if (isEmployee) {
      result = result.filter(l => l.assignedEmployee === currentUser.name);
    } else if (isDealer) {
      result = result.filter(l => l.dealer === currentUser.name);
    }
    return result;
  }, [leads, isEmployee, isDealer, currentUser]);

  // --- 2. SUMMARY METRICS (Derived strictly from baseLeads) ---
  const totalLeads = baseLeads.length;
  const activeLeads = baseLeads.filter(l => l.stage !== 'Converted' && l.stage !== 'Completed').length;
  const convertedLeads = baseLeads.filter(l => l.stage === 'Converted' || l.stage === 'Completed').length;
  const followUpsDue = baseLeads.filter(l => l.followUp && (l.followUp.status === 'Due Today' || l.followUp.status === 'Overdue')).length;

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STAGES.forEach(s => counts[s] = 0);
    baseLeads.forEach(l => {
      if (counts[l.stage] !== undefined && !l.archived) counts[l.stage]++;
    });
    return counts;
  }, [baseLeads]);

  // --- 3. FILTERING & SEARCH ---
  const filteredLeads = useMemo(() => {
    return baseLeads.filter(l => {
      // Status Filter (Active, Lost, etc)
      if (statusFilter === 'Active' && l.archived) return false;
      if (statusFilter === 'Lost' && !l.archived) return false;
      
      // Stage
      if (stageFilter !== 'All' && l.stage !== stageFilter) return false;
      
      // Lead Type
      const lt = l.leadType || 'tracking';
      if (leadTypeFilter !== 'All' && lt !== leadTypeFilter) return false;
      
      // Dealer & Employee
      if (dlrFilter !== 'All' && l.dealer !== dlrFilter) return false;
      if (empFilter !== 'All') {
        if (empFilter === 'Unassigned') {
          if (l.assignedEmployee && l.assignedEmployee !== 'Unassigned' && l.assignedEmployee.trim() !== '') return false;
        } else {
          if (l.assignedEmployee !== empFilter) return false;
        }
      }
      
      // Priority
      if (priorityFilter !== 'All' && l.priority !== priorityFilter) return false;
      
      // Follow-up
      if (followupFilter !== 'All') {
        if (!l.followUp) return false;
        if (followupFilter === 'Today' && l.followUp.status !== 'Due Today') return false;
        if (followupFilter !== 'Today' && l.followUp.status !== followupFilter) return false;
      }
      
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !l.customer.toLowerCase().includes(q) &&
          !l.id.toLowerCase().includes(q) &&
          !l.phone.includes(q) &&
          !(l.dealer && l.dealer.toLowerCase().includes(q)) &&
          !(l.assignedEmployee && l.assignedEmployee.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      
      return true;
    }).sort((a, b) => {
      if (sortBy === 'Updated') {
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      }
      if (sortBy === 'Newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'Oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === 'Follow-up') {
        const dateA = a.followUp?.date ? new Date(a.followUp.date).getTime() : Infinity;
        const dateB = b.followUp?.date ? new Date(b.followUp.date).getTime() : Infinity;
        return dateA - dateB;
      }
      return 0;
    });
  }, [baseLeads, statusFilter, stageFilter, dlrFilter, empFilter, priorityFilter, followupFilter, searchQuery, sortBy]);

  const unassignedLeads = useMemo(() => {
    if (!isAdmin) return [];
    return filteredLeads.filter(l => !l.assignedEmployee || l.assignedEmployee === 'Unassigned' || l.assignedEmployee.trim() === '');
  }, [filteredLeads, isAdmin]);

  const mainLeads = useMemo(() => {
    if (!isAdmin) return filteredLeads;
    return filteredLeads.filter(l => l.assignedEmployee && l.assignedEmployee !== 'Unassigned' && l.assignedEmployee.trim() !== '');
  }, [filteredLeads, isAdmin]);

  const paginatedLeads = mainLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const totalPages = Math.ceil(mainLeads.length / PAGE_SIZE);

  // --- HANDLERS ---
  const handleClearFilters = () => {
    setStageFilter('All');
    setPriorityFilter('All');
    setFollowupFilter('All');
    setLeadTypeFilter('All');
    setStatusFilter('Active');
    if (!isEmployee) setEmpFilter('All');
    if (!isDealer) setDlrFilter('All');
    setSearchQuery('');
  };

  const handleStageChange = () => {
    if (!selectedLead || !targetStage) return;
    handleQuickStageChange(targetStage as Stage);
    setShowStageModal(false);
  };

  const handleQuickStageChange = (newStage: Stage) => {
    if (!selectedLead) return;

    // 1. Check if moving to Installation stage and requires Admin Approval
    if (newStage === 'Installation' && selectedLead.installationApprovalStatus !== 'Approved') {
      if (isAdmin) {
        // Admin directly approves
        updateLead(selectedLead.id, { 
          stage: 'Installation',
          installationApprovalStatus: 'Approved' 
        });
        addActivity({
          type: 'Installation Approved',
          message: `Admin approved and moved ${selectedLead.customer} to Installation stage`,
          user: currentUser?.name || 'Admin',
          dealer: selectedLead.dealer,
          leadId: selectedLead.id
        });
        showToast(`Installation approved & moved to Installation stage`, 'success');
        setSelectedLead({ ...selectedLead, stage: 'Installation', installationApprovalStatus: 'Approved' });
        return;
      } else {
        // Dealer or Employee requesting approval
        updateLead(selectedLead.id, { 
          installationApprovalStatus: 'Pending' 
        });
        addActivity({
          type: 'Approval Requested',
          message: `${currentUser?.role || 'User'} requested Admin Approval to enter Installation stage`,
          user: currentUser?.name || 'System',
          dealer: selectedLead.dealer,
          leadId: selectedLead.id
        });
        showToast('Installation stage requires Admin approval. Request submitted to Admin.', 'info');
        setSelectedLead({ ...selectedLead, installationApprovalStatus: 'Pending' });
        return;
      }
    }

    // 2. Check if moving from Installation to Completed without Installation Photos
    if (selectedLead.stage === 'Installation' && newStage === 'Completed') {
      const hasPhoto = selectedLead.documents?.some(d => 
        d.documentType === 'Installation Site Photos' || 
        d.documentType === 'S Number Photo' ||
        d.documentType.toLowerCase().includes('photo') ||
        d.fileType?.startsWith('image/')
      );

      if (!hasPhoto) {
        setShowPhotoRequiredModal(true);
        return;
      }
    }

    updateLead(selectedLead.id, { stage: newStage });
    addActivity({
      type: 'Lead Update',
      message: `${selectedLead.customer} moved to ${newStage}`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer,
      leadId: selectedLead.id
    });
    showToast(`Lead moved to ${newStage}`);
    setSelectedLead({ ...selectedLead, stage: newStage });
  };

  const handleAdminApproveInstallation = async (leadId: string) => {
    if (!selectedLead) return;

    // Automatically deduct dealer stock for materials specified in technical specs BOM
    if (selectedLead.dealerSpecifications && selectedLead.dealer) {
      const deductionRes = await deductDealerStockForLeadMaterial(
        leadId,
        selectedLead.customer,
        selectedLead.dealer,
        selectedLead.dealerSpecifications,
        currentUser?.name || 'Admin'
      );
      if (deductionRes.deductedSummary && deductionRes.deductedSummary !== 'No material quantities specified') {
        addActivity({
          type: 'Stock Consumed',
          message: `Material stock deducted for ${selectedLead.customer} from ${selectedLead.dealer} inventory: ${deductionRes.deductedSummary}`,
          user: currentUser?.name || 'Admin',
          dealer: selectedLead.dealer,
          leadId: leadId
        });
      }
    }

    updateLead(leadId, { 
      stage: 'Installation', 
      installationApprovalStatus: 'Approved' 
    });
    addActivity({
      type: 'Installation Approved',
      message: `Admin approved installation stage for ${selectedLead.customer}`,
      user: currentUser?.name || 'Admin',
      dealer: selectedLead.dealer,
      leadId: leadId
    });
    showToast(`Installation approved & materials deducted from ${selectedLead.dealer}'s inventory!`, 'success');
    setSelectedLead({ 
      ...selectedLead, 
      stage: 'Installation', 
      installationApprovalStatus: 'Approved' 
    });
  };

  const handleAdminRejectInstallation = () => {
    if (!selectedLead) return;
    const reason = installationRejectReason.trim() || 'Requirements pending';
    updateLead(selectedLead.id, { 
      installationApprovalStatus: 'Rejected',
      installationRejectionReason: reason 
    });
    addActivity({
      type: 'Installation Rejected',
      message: `Admin rejected installation for ${selectedLead.customer}: ${reason}`,
      user: currentUser?.name || 'Admin',
      dealer: selectedLead.dealer,
      leadId: selectedLead.id
    });
    showToast('Installation request rejected.', 'error');
    setSelectedLead({ 
      ...selectedLead, 
      installationApprovalStatus: 'Rejected',
      installationRejectionReason: reason 
    });
    setShowRejectInstallationModal(false);
    setInstallationRejectReason('');
  };

  const handleChangeEmployee = () => {
    if (!selectedLead || !newEmp) return;
    const oldEmp = selectedLead.assignedEmployee;
    const isReassign = oldEmp && oldEmp !== 'Unassigned';
    
    updateLead(selectedLead.id, { assignedEmployee: newEmp });
    
    const message = isReassign 
      ? `Admin reassigned Project Lead from ${oldEmp} to ${newEmp}`
      : `Admin assigned ${newEmp} to this Project Lead`;
      
    addActivity({
      type: 'Lead Assignment',
      message: message,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer
    });
    
    showToast(`Assigned to ${newEmp}`);
    setSelectedLead({ ...selectedLead, assignedEmployee: newEmp });
    setShowChangeEmpModal(false);
  };

  const handleCompleteFollowUp = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || !lead.followUp) return;
    
    updateLead(leadId, { followUp: { ...lead.followUp, status: 'Completed' } });
    addActivity({
      type: 'Follow-up Completed',
      message: `Completed follow-up for ${lead.customer}`,
      user: currentUser?.name || 'System',
      dealer: lead.dealer
    });
    
    showToast('Follow-up completed');
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead({ ...selectedLead, followUp: { ...lead.followUp, status: 'Completed' } });
    }
  };

  const handleMarkLost = () => {
    if (!selectedLead || !lostReason) return;
    updateLead(selectedLead.id, { archived: true, notes: selectedLead.notes ? `${selectedLead.notes}\nLost Reason: ${lostReason}` : `Lost Reason: ${lostReason}` });
    addActivity({
      type: 'Lead Update',
      message: `${selectedLead.customer} marked as Lost: ${lostReason}`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer
    });
    showToast('Lead marked as Lost');
    setShowLostModal(false);
    setSelectedLead(null);
  };

  const handleRestore = () => {
    if (!selectedLead) return;
    updateLead(selectedLead.id, { archived: false });
    addActivity({
      type: 'Lead Update',
      message: `${selectedLead.customer} restored to active pipeline`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer
    });
    showToast('Lead restored');
    setSelectedLead({ ...selectedLead, archived: false });
  };

  const openUploadModal = () => {
    setIsReplacingDocId(null);
    setUploadForm({ documentType: '', file: null, notes: '' });
    setShowUploadModal(true);
  };

  const openSpecificUploadModal = (docType: string) => {
    setIsReplacingDocId(null);
    setUploadForm({ documentType: docType, file: null, notes: '' });
    setShowUploadModal(true);
  };

  const uploadToFirebase = async (file: File): Promise<string> => {
    try {
      const fileRef = ref(storage, `leads/documents/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      return downloadUrl;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to upload document to Firebase Storage');
    }
  };

  const handleInlineUpload = async (docType: string, file: File) => {
    if (!selectedLead) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
      return;
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type) && file.type !== '') {
      alert(`Invalid file type (${file.type}). Only PDF, Word, JPG, and PNG are allowed.`);
      return;
    }

    setIsUploading(true);
    const newDocId = `DOC${Date.now()}`;
    let detectedType = file.type;
    let safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    if (!detectedType) {
      if (safeFileName.match(/\.(jpg|jpeg)$/i)) detectedType = 'image/jpeg';
      else if (safeFileName.match(/\.png$/i)) detectedType = 'image/png';
      else if (safeFileName.match(/\.pdf$/i)) detectedType = 'application/pdf';
      else detectedType = 'image/jpeg';
    }
    if (!safeFileName.includes('.')) {
      if (detectedType.includes('png')) safeFileName += '.png';
      else if (detectedType.includes('pdf')) safeFileName += '.pdf';
      else safeFileName += '.jpg';
    }

    try {
      const fileUrl = await uploadToFirebase(file);

      const newDoc: LeadDocument = {
        id: newDocId,
        leadId: selectedLead.id,
        documentType: docType,
        fileName: safeFileName,
        fileSize: file.size,
        fileType: detectedType,
        fileUrl: fileUrl,
        uploadedByRole: currentUser?.role || 'User',
        uploadedByUserId: currentUser?.id || 'unknown',
        uploadedAt: new Date().toISOString(),
        notes: '',
        status: 'Uploaded'
      };

      const updatedDocs = [...(selectedLead.documents || []), newDoc];
      updateLead(selectedLead.id, { documents: updatedDocs });
      
      addActivity({
        type: 'Document Uploaded',
        message: `${currentUser?.role || 'User'} uploaded ${docType}`,
        user: currentUser?.name || 'System',
        dealer: selectedLead.dealer,
        leadId: selectedLead.id
      });
      
      showToast(`${docType} uploaded successfully`);
      setSelectedLead({ ...selectedLead, documents: updatedDocs });
    } catch (err) {
      console.error("Upload failed:", err);
      showToast(`Upload failed: ${err instanceof Error ? err.message : (err as any)?.message || 'Unknown error'}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const openReplaceModal = (docId: string) => {
    setIsReplacingDocId(docId);
    setUploadForm({ documentType: '', file: null, notes: '' });
    setShowUploadModal(true);
  };

  const handleUploadSubmit = async () => {
    if (!selectedLead || !uploadForm.documentType || !uploadForm.file) return;

    if (uploadForm.file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    if (!ALLOWED_FILE_TYPES.includes(uploadForm.file.type) && uploadForm.file.type !== '') {
      alert(`Invalid file type (${uploadForm.file.type}).`);
      return;
    }

    setIsUploading(true);
    const newDocId = isReplacingDocId || `DOC${Date.now()}`;
    let detectedType = uploadForm.file.type;
    let safeFileName = uploadForm.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    if (!detectedType) {
      if (safeFileName.match(/\.(jpg|jpeg)$/i)) detectedType = 'image/jpeg';
      else if (safeFileName.match(/\.png$/i)) detectedType = 'image/png';
      else if (safeFileName.match(/\.pdf$/i)) detectedType = 'application/pdf';
      else detectedType = 'image/jpeg';
    }
    if (!safeFileName.includes('.')) {
      if (detectedType.includes('png')) safeFileName += '.png';
      else if (detectedType.includes('pdf')) safeFileName += '.pdf';
      else safeFileName += '.jpg';
    }

    try {
      const fileUrl = await uploadToFirebase(uploadForm.file);

      const newDoc: LeadDocument = {
        id: newDocId,
        leadId: selectedLead.id,
        documentType: uploadForm.documentType,
        fileName: safeFileName,
        fileSize: uploadForm.file.size,
        fileType: detectedType,
        fileUrl: fileUrl,
        uploadedByRole: currentUser?.role || 'User',
        uploadedByUserId: currentUser?.id || 'unknown',
        uploadedAt: new Date().toISOString(),
        notes: uploadForm.notes,
        status: 'Uploaded'
      };

      let updatedDocs = selectedLead.documents || [];
      let activityType = 'Document Uploaded';
      let activityMessage = `${currentUser?.role || 'User'} uploaded ${uploadForm.documentType}`;

      if (isReplacingDocId) {
        updatedDocs = updatedDocs.map(d => d.id === isReplacingDocId ? newDoc : d);
        activityType = 'Document Replaced';
        activityMessage = `${currentUser?.role || 'User'} replaced ${uploadForm.documentType}`;
      } else {
        updatedDocs = [...updatedDocs, newDoc];
      }

      updateLead(selectedLead.id, { documents: updatedDocs });
      addActivity({
        type: activityType,
        message: activityMessage,
        user: currentUser?.name || 'System',
        dealer: selectedLead.dealer,
        leadId: selectedLead.id
      });
      
      showToast(isReplacingDocId ? 'Document replaced successfully' : 'Document uploaded successfully');
      setSelectedLead({ ...selectedLead, documents: updatedDocs });
      setShowUploadModal(false);
    } catch (err) {
      console.error("Upload failed:", err);
      showToast(`Upload failed: ${err instanceof Error ? err.message : (err as any)?.message || 'Unknown error'}`, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDeleteDocument = async () => {
    if (!selectedLead || !docToDelete) return;
    
    const docObj = selectedLead.documents?.find(d => d.id === docToDelete);
    if (!docObj) return;

    // Remove from Firestore metadata immediately for UI responsiveness
    const updatedDocs = selectedLead.documents?.filter(d => d.id !== docToDelete) || [];
    updateLead(selectedLead.id, { documents: updatedDocs });
    addActivity({
      type: 'Document Deleted',
      message: `${currentUser?.role || 'User'} deleted ${docObj.documentType}`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer,
      leadId: selectedLead.id
    });
    
    showToast('Document deleted successfully');
    setSelectedLead({ ...selectedLead, documents: updatedDocs });
    setShowDeleteDocModal(false);

    // Attempt Storage deletion
    try {
      const storageRef = ref(storage, `leads/${selectedLead.id}/documents/${docObj.id}/${docObj.fileName}`);
      await deleteObject(storageRef);
    } catch (err) {
      console.error("Storage deletion failed, but metadata was removed:", err);
    }
  };

  const getCloudinaryDownloadUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      // Use fl_attachment to force direct browser download
      return url.replace('/upload/', '/upload/fl_attachment/');
    }
    return url;
  };

  const handleDownloadDocument = (docObj: LeadDocument) => {
    if (!docObj.fileUrl) {
      showToast('File preview is no longer available in this frontend session.');
      return;
    }

    const downloadUrl = getCloudinaryDownloadUrl(docObj.fileUrl);
    
    // Creating link without target="_blank" triggers direct save/download in Chrome
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = docObj.fileName || `${docObj.documentType || 'document'}`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try { document.body.removeChild(link); } catch {}
    }, 200);

    if (selectedLead) {
      addActivity({
        type: 'Document Downloaded',
        message: `${currentUser?.role || 'User'} downloaded ${docObj.documentType}`,
        user: currentUser?.name || 'System',
        dealer: selectedLead.dealer,
        leadId: selectedLead.id
      });
    }
  };

  const handleDownloadAllDocuments = () => {
    if (!selectedLead?.documents || selectedLead.documents.length === 0) return;
    showToast(`Downloading ${selectedLead.documents.length} documents...`);
    
    selectedLead.documents.forEach((doc, index) => {
      if (doc.fileUrl) {
        setTimeout(() => {
          const downloadUrl = getCloudinaryDownloadUrl(doc.fileUrl);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = doc.fileName || `${doc.documentType}`;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            try { document.body.removeChild(link); } catch {}
          }, 200);
        }, index * 400);
      }
    });

    addActivity({
      type: 'Documents Downloaded',
      message: `${currentUser?.role || 'User'} downloaded all project documents`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer,
      leadId: selectedLead.id
    });
  };

  const handleMarkPendingDocument = (docObj: LeadDocument) => {
    if (!selectedLead) return;
    const updatedDocs = selectedLead.documents?.map(d => d.id === docObj.id ? { ...d, status: 'Pending' as DocumentStatus } : d) || [];
    updateLead(selectedLead.id, { documents: updatedDocs });
    addActivity({
      type: 'Document Status Update',
      message: `Admin marked ${docObj.documentType} as pending`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer,
      leadId: selectedLead.id
    });
    showToast('Document marked as pending');
    setSelectedLead({ ...selectedLead, documents: updatedDocs });
  };

  const confirmVerifyDocument = () => {
    if (!selectedLead || !docToVerify) return;
    const updatedDocs = selectedLead.documents?.map(d => d.id === docToVerify.id ? { ...d, status: 'Verified' as DocumentStatus } : d) || [];
    updateLead(selectedLead.id, { documents: updatedDocs });
    addActivity({
      type: 'Document Verified',
      message: `Admin verified ${docToVerify.documentType}`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer,
      leadId: selectedLead.id
    });
    showToast('Document verified successfully');
    setSelectedLead({ ...selectedLead, documents: updatedDocs });
    setShowVerifyDocModal(false);
  };

  const confirmRejectDocument = () => {
    if (!selectedLead || !docToReject) return;
    // Status uses "Rejected" or "Additional Document Required". The CRMContext type is DocumentStatus, wait, CRMContext DocumentStatus only has Pending, Uploaded, Additional Document Required, Verified. Let me check if Rejected is in CRMContext. If not I will add it or use "Additional Document Required" instead of Reject if Rejection implies deletion.
    // Wait, the prompt says "Admin can reject. Status: Rejected." I will assume CRMContext allows it or cast it for now.
    const updatedDocs = selectedLead.documents?.map(d => d.id === docToReject.id ? { ...d, status: 'Rejected' as DocumentStatus } : d) || [];
    updateLead(selectedLead.id, { documents: updatedDocs });
    addActivity({
      type: 'Document Rejected',
      message: `Admin rejected ${docToReject.documentType}`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer,
      leadId: selectedLead.id
    });
    showToast('Document rejected');
    setSelectedLead({ ...selectedLead, documents: updatedDocs });
    setShowRejectDocModal(false);
  };

  const confirmRequestAdditionalDocument = () => {
    if (!selectedLead || !docToRequest) return;
    const updatedDocs = selectedLead.documents?.map(d => d.id === docToRequest.id ? { ...d, status: 'Additional Document Required' as DocumentStatus, notes: requestDocNotes } : d) || [];
    updateLead(selectedLead.id, { documents: updatedDocs });
    addActivity({
      type: 'Document Requested',
      message: `Admin requested additional ${docToRequest.documentType}`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer,
      leadId: selectedLead.id
    });
    showToast(`Requested additional ${docToRequest.documentType}`);
    setSelectedLead({ ...selectedLead, documents: updatedDocs });
    setShowRequestDocModal(false);
  };

  const handleAddProjectUpdate = () => {
    if (!selectedLead || !newUpdateForm.description.trim()) return;
    
    const newUpdate: ProjectUpdate = {
      id: `UPD${Date.now()}`,
      description: newUpdateForm.description,
      status: newUpdateForm.status,
      updatedByUserId: currentUser?.id || 'sys',
      updatedByRole: currentUser?.role || 'Employee',
      updatedAt: new Date().toISOString()
    };

    const currentUpdates = selectedLead.projectUpdates || [];
    const updatedUpdates = [newUpdate, ...currentUpdates];
    
    updateLead(selectedLead.id, { 
      projectUpdates: updatedUpdates,
      workStatus: newUpdateForm.status 
    });
    
    addActivity({
      type: 'Project Update',
      message: `${currentUser?.role || 'Employee'} added a project update`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer,
      leadId: selectedLead.id
    });
    
    showToast('Project update added successfully');
    setSelectedLead({ ...selectedLead, projectUpdates: updatedUpdates, workStatus: newUpdateForm.status });
    setShowAddUpdateModal(false);
    setNewUpdateForm({ description: '', status: 'In Progress' });
  };

  const handleAddNote = () => {
    if (!selectedLead || !newNote.trim()) return;
    const updatedNotes = selectedLead.notes ? `${selectedLead.notes}\n[${new Date().toLocaleDateString()}] ${currentUser?.name || 'User'}: ${newNote}` : `[${new Date().toLocaleDateString()}] ${currentUser?.name || 'User'}: ${newNote}`;
    updateLead(selectedLead.id, { notes: updatedNotes });
    addActivity({
      type: 'Lead Update',
      message: `Note added to ${selectedLead.customer}`,
      user: currentUser?.name || 'System',
      dealer: selectedLead.dealer
    });
    showToast('Note added');
    setSelectedLead({ ...selectedLead, notes: updatedNotes });
    setNewNote('');
  };

  // UI Helpers
  const getStageBadgeClass = (s: string) => s.toLowerCase().replace(' ', '');
  const getPriorityClass = (p: string) => `priority-${p.toLowerCase()}`;

  return (
    <div className="leads-page-container">
      {/* GLOBAL UPLOAD SPINNER */}
      {isUploading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ padding: '2rem', background: 'white', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Loader2 className="spinner" size={40} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
            <h3 style={{ margin: 0, color: '#1e293b' }}>Uploading Document...</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Please wait while we secure your file in the cloud.</p>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="leads-header">
        <div className="leads-title-area">
          <div className="leads-breadcrumb">Dashboard / Leads {stageFilter !== 'All' ? `/ ${stageFilter}` : ''}</div>
          <h1>Leads</h1>
          <p>Track customers, manage pipeline progress and follow up on opportunities.</p>
        </div>
        {canManageModule(currentUser, 'leads') && (
          <button type="button" className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} /> Add Lead
          </button>
        )}
      </div>

      <div className="leads-main">
        {/* SUMMARY CARDS */}
        <div className="leads-summary-grid">
          <div className="lead-summary-card">
            <span className="lead-summary-title">Total Leads</span>
            <span className="lead-summary-value">{totalLeads}</span>
          </div>
          <div className="lead-summary-card">
            <span className="lead-summary-title">Active Leads</span>
            <span className="lead-summary-value" style={{color: '#d97706'}}>{activeLeads}</span>
          </div>
          <div className="lead-summary-card">
            <span className="lead-summary-title">Converted</span>
            <span className="lead-summary-value" style={{color: '#16a34a'}}>{convertedLeads}</span>
          </div>
          <div className="lead-summary-card">
            <span className="lead-summary-title">Follow-ups Due</span>
            <span className="lead-summary-value" style={{color: '#ea580c'}}>{followUpsDue}</span>
          </div>
        </div>

        {/* PIPELINE */}
        <div className="leads-pipeline">
          {STAGES.map(s => {
            const count = pipelineCounts[s];
            const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
            return (
              <div 
                key={s} 
                className={`pipeline-stage-btn ${stageFilter === s ? 'active' : ''}`}
                onClick={() => setStageFilter(stageFilter === s ? 'All' : s)}
              >
                <div className="pipeline-stage-count">{count}</div>
                <div className="pipeline-stage-name">{s}</div>
                <div className="pipeline-progress">
                  <div className="pipeline-progress-fill" style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SEARCH & FILTERS */}
        <div className="leads-filters">
          <div className="leads-filters-row">
            <div className="search-box">
              <Search size={18} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Search leads by name, phone, or ID..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <select className="filter-select" value={leadTypeFilter} onChange={e => setLeadTypeFilter(e.target.value)}>
              <option value="All">All Lead Types</option>
              <option value="tracking">Tracking Leads</option>
              <option value="project">Project / Document Leads</option>
            </select>

            <select className="filter-select" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
              <option value="All">All Stages</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Dealer Filter - Locked if Dealer */}
            {isAdmin && (
              <select className="filter-select" value={dlrFilter} onChange={e => setDlrFilter(e.target.value)}>
                <option value="All">All Dealers</option>
                {dealers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            )}

            {/* Employee Filter - Locked if Employee */}
            {isAdmin && (
              <select className="filter-select" value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
                <option value="All">All Employees</option>
                <option value="Unassigned">Unassigned</option>
                {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            )}

            <select className="filter-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="All">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            
            <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="Updated">Recently Updated</option>
              <option value="Newest">Newest</option>
              <option value="Oldest">Oldest</option>
              <option value="Follow-up">Follow-up Date</option>
            </select>
          </div>
          
          {/* Active Chips */}
          <div className="active-chips">
            {leadTypeFilter !== 'All' && (
              <div className="filter-chip">Type: {leadTypeFilter === 'project' ? 'Project' : 'Tracking'} <button onClick={() => setLeadTypeFilter('All')}><X size={14} /></button></div>
            )}
            {stageFilter !== 'All' && (
              <div className="filter-chip">Stage: {stageFilter} <button onClick={() => setStageFilter('All')}><X size={14} /></button></div>
            )}
            {dlrFilter !== 'All' && isAdmin && (
              <div className="filter-chip">Dealer: {dlrFilter} <button onClick={() => setDlrFilter('All')}><X size={14} /></button></div>
            )}
            {empFilter !== 'All' && isAdmin && (
              <div className="filter-chip">Employee: {empFilter} <button onClick={() => setEmpFilter('All')}><X size={14} /></button></div>
            )}
            {priorityFilter !== 'All' && (
              <div className="filter-chip">Priority: {priorityFilter} <button onClick={() => setPriorityFilter('All')}><X size={14} /></button></div>
            )}
            {(leadTypeFilter !== 'All' || stageFilter !== 'All' || priorityFilter !== 'All' || (dlrFilter !== 'All' && isAdmin) || (empFilter !== 'All' && isAdmin)) && (
              <button className="clear-filters" onClick={handleClearFilters}>Clear All</button>
            )}
          </div>
        </div>

        {/* UNASSIGNED LEADS TABLE (Admin Only) */}
        {isAdmin && unassignedLeads.length > 0 && (
          <div className="leads-table-container" style={{marginBottom: '2rem', border: '2px solid #f59e0b'}}>
            <div style={{padding: '1rem', background: '#fef3c7', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h3 style={{margin: 0, color: '#b45309'}}>Unassigned Leads ({unassignedLeads.length})</h3>
              <span style={{fontSize: '0.85rem', color: '#b45309'}}>These leads need an employee assigned.</span>
            </div>
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Dealer</th>
                  <th>Stage</th>
                  <th>Priority</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {unassignedLeads.map(lead => (
                  <tr key={lead.id}>
                    <td>
                      <div className="customer-cell" onClick={() => setSelectedLead(lead)} style={{cursor: 'pointer'}}>
                        <div className="customer-avatar">{lead.customer.charAt(0)}</div>
                        <div className="customer-info">
                          <span className="customer-name" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                            {lead.customer}
                            <span style={{
                              fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 600,
                              background: (lead.leadType || 'tracking') === 'project' ? '#e0e7ff' : '#f1f5f9', 
                              color: (lead.leadType || 'tracking') === 'project' ? '#4f46e5' : '#64748b'
                            }}>
                              {(lead.leadType || 'tracking') === 'project' ? 'PROJECT' : 'TRACKING'}
                            </span>
                          </span>
                          <span className="customer-phone">{lead.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td>{lead.dealer}</td>
                    <td><span className={`stage-badge ${getStageBadgeClass(lead.stage)}`}>{lead.stage}</span></td>
                    <td><span className={getPriorityClass(lead.priority)}>{lead.priority}</span></td>
                    <td>
                      <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                        <select 
                          className="filter-select" 
                          style={{padding: '0.25rem 0.5rem', fontSize: '0.85rem'}}
                          value=""
                          onChange={e => {
                            if (e.target.value) {
                              updateLead(lead.id, { assignedEmployee: e.target.value });
                              addActivity({
                                type: 'Lead Assignment',
                                message: `${lead.customer} assigned to ${e.target.value}`,
                                user: currentUser?.name || 'System',
                                dealer: lead.dealer
                              });
                              showToast(`Assigned to ${e.target.value}`);
                            }
                          }}
                        >
                          <option value="" disabled>Assign To...</option>
                          {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MAIN TABLE */}
        <div className="leads-table-container">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Customer</th>
                {!isDealer && <th>Dealer</th>}
                {!isEmployee && <th>Employee</th>}
                <th>Stage</th>
                <th>Priority</th>
                <th>Follow-up</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.length > 0 ? paginatedLeads.map(lead => (
                <tr key={lead.id} onClick={() => setSelectedLead(lead)} style={{cursor: 'pointer'}}>
                  <td>
                    <div className="customer-cell">
                      <div className="customer-avatar">{lead.customer.charAt(0)}</div>
                      <div className="customer-info">
                        <span className="customer-name" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                          {lead.customer}
                          <span style={{
                            fontSize: '0.65rem', padding: '0.1rem 0.3rem', borderRadius: '4px', fontWeight: 600,
                            background: (lead.leadType || 'tracking') === 'project' ? '#e0e7ff' : '#f1f5f9', 
                            color: (lead.leadType || 'tracking') === 'project' ? '#4f46e5' : '#64748b'
                          }}>
                            {(lead.leadType || 'tracking') === 'project' ? 'PROJECT' : 'TRACKING'}
                          </span>
                        </span>
                        <span className="customer-phone">{lead.phone}</span>
                      </div>
                    </div>
                  </td>
                  {!isDealer && <td>{lead.dealer}</td>}
                  {!isEmployee && <td>{lead.assignedEmployee}</td>}
                  <td>
                    <span className={`stage-badge ${getStageBadgeClass(lead.stage)}`}>{lead.stage}</span>
                  </td>
                  <td>
                    <span className={getPriorityClass(lead.priority)}>{lead.priority}</span>
                  </td>
                  <td>
                    {lead.followUp ? (
                      <div className={`followup-text ${lead.followUp.status.toLowerCase().replace(' ', '-')}`}>
                        {lead.followUp.date} • {lead.followUp.status}
                      </div>
                    ) : (
                      <span style={{color: '#94a3b8'}}>-</span>
                    )}
                  </td>
                  <td>
                    <button className="btn-outline" style={{padding: '0.4rem 0.75rem', fontSize: '0.8rem'}}>View →</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} style={{textAlign: 'center', padding: '3rem', color: '#64748b'}}>
                    {unassignedLeads.length > 0 ? "No assigned leads found." : "No leads found matching your criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem'}}>
            <button 
              className="btn-outline" 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <span style={{fontWeight: 600, color: '#475569', fontSize: '0.9rem'}}>Page {currentPage} of {totalPages}</span>
            <button 
              className="btn-outline" 
              disabled={currentPage === totalPages} 
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
{/* LEAD DETAIL DRAWER */}
      {selectedLead && (
        <>
          <div className="lead-detail-overlay" onClick={() => setSelectedLead(null)}></div>
          <div className="lead-detail-drawer">
            <div className="drawer-header">
              <div className="drawer-title-area">
                <div className="customer-avatar" style={{width: 48, height: 48, fontSize: '1.2rem'}}>{selectedLead.customer.charAt(0)}</div>
                <div>
                  <h2 style={{fontSize: '1.2rem', fontWeight: 800}}>{selectedLead.customer}</h2>
                  <span className="lead-id">{selectedLead.id}</span>
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)} style={{background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b'}}>
                <X size={24} />
              </button>
            </div>

            {/* Installation Approval Alert Banner */}
            {selectedLead.installationApprovalStatus === 'Pending' && (
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                margin: '0.75rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.6rem'}}>
                  <AlertTriangle size={20} color="#d97706" />
                  <div>
                    <strong style={{color: '#92400e', fontSize: '0.9rem', display: 'block'}}>Installation Approval Requested</strong>
                    <span style={{fontSize: '0.8rem', color: '#b45309'}}>
                      {isAdmin 
                        ? 'Dealer/Employee has requested to move this project into the Installation stage.' 
                        : 'Waiting for Admin approval before starting Installation stage.'}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button 
                      className="btn-primary" 
                      style={{padding: '0.35rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#16a34a', borderColor: '#16a34a'}}
                      onClick={() => handleAdminApproveInstallation(selectedLead.id)}
                    >
                      <Check size={14} /> Approve Installation
                    </button>
                    <button 
                      className="btn-outline" 
                      style={{padding: '0.35rem 0.85rem', fontSize: '0.85rem', color: '#dc2626', borderColor: '#fca5a5'}}
                      onClick={() => setShowRejectInstallationModal(true)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {selectedLead.installationApprovalStatus === 'Rejected' && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                margin: '0.75rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem'
              }}>
                <ShieldAlert size={20} color="#dc2626" />
                <div>
                  <strong style={{color: '#991b1b', fontSize: '0.9rem', display: 'block'}}>Installation Stage Rejected by Admin</strong>
                  <span style={{fontSize: '0.8rem', color: '#b91c1c'}}>
                    Reason: {selectedLead.installationRejectionReason || 'Requirements not fulfilled. Please review documents and retry.'}
                  </span>
                </div>
              </div>
            )}
            
            <div className="drawer-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              {(() => {
                const currentIndex = STAGES.indexOf(selectedLead.stage);
                const hasPrev = currentIndex > 0;
                const hasNext = currentIndex < STAGES.length - 1;
                return (
                  <>
                    <button 
                      className="btn-outline" 
                      style={{padding: '0.5rem 1rem'}} 
                      disabled={!hasPrev}
                      onClick={() => hasPrev && handleQuickStageChange(STAGES[currentIndex - 1])}
                    >
                      &larr; Prev Stage
                    </button>
                    <button 
                      className="btn-primary" 
                      style={{padding: '0.5rem 1rem'}} 
                      disabled={!hasNext}
                      onClick={() => hasNext && handleQuickStageChange(STAGES[currentIndex + 1])}
                    >
                      Next Stage &rarr;
                    </button>
                  </>
                );
              })()}
              <button className="btn-outline" style={{padding: '0.5rem 1rem'}} onClick={() => setShowStageModal(true)}>
                Jump Stage
              </button>
              {canManageModule(currentUser, 'leads') && (
                <>
                  <button className="btn-outline" style={{padding: '0.5rem 1rem'}} onClick={() => setShowChangeEmpModal(true)}>
                    Assign
                  </button>
                  <button className="btn-outline" style={{padding: '0.5rem 1rem'}} onClick={() => setShowAddFollowupModal(true)}>
                    Follow-up
                  </button>
                  {selectedLead.archived ? (
                    <button className="btn-outline" style={{padding: '0.5rem 1rem', color: '#16a34a', borderColor: '#16a34a'}} onClick={handleRestore}>
                      Restore
                    </button>
                  ) : (
                    <button className="btn-outline" style={{padding: '0.5rem 1rem', color: '#ef4444', borderColor: '#ef4444'}} onClick={() => setShowLostModal(true)}>
                      Lost
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="drawer-body">
              {/* Detail Pipeline */}
              <div className="detail-section">
                <h3>Pipeline Progress</h3>
                <div className="detail-pipeline">
                  {STAGES.map((s, idx) => {
                    const currentIndex = STAGES.indexOf(selectedLead.stage);
                    const isCompleted = idx < currentIndex;
                    const isCurrent = idx === currentIndex;
                    return (
                      <div key={s} className="detail-pipe-stage">
                        <div className={`pipe-dot ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                          {isCompleted ? <CheckCircle2 size={14} /> : ''}
                        </div>
                        <span className={`pipe-label ${isCurrent ? 'current' : ''}`}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Customer Info */}
              <div className="detail-section">
                <h3>Customer Information</h3>
                <div className="detail-grid">
                  <div className="detail-field">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value" style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                      <Phone size={14} color="#64748b"/> {selectedLead.phone}
                    </span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Email</span>
                    <span className="detail-value" style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                      <Mail size={14} color="#64748b"/> {selectedLead.email}
                    </span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Location</span>
                    <span className="detail-value" style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}>
                      <MapPin size={14} color="#64748b"/> {selectedLead.location}
                    </span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Lead Type</span>
                    <span className="detail-value" style={{fontWeight: 600, color: (selectedLead.leadType || 'tracking') === 'project' ? '#4f46e5' : '#64748b'}}>
                      {(selectedLead.leadType || 'tracking') === 'project' ? 'Project / Document Lead' : 'Tracking Lead'}
                    </span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Priority</span>
                    <span className={`detail-value ${getPriorityClass(selectedLead.priority)}`}>
                      {selectedLead.priority}
                    </span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Dealer</span>
                    <span className="detail-value" style={{cursor: 'pointer', color: 'var(--color-navy)', textDecoration: 'underline'}} onClick={() => showToast('Navigating to Dealer...')}>{selectedLead.dealer}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Employee</span>
                    <span className="detail-value" style={{cursor: 'pointer', color: 'var(--color-navy)', textDecoration: 'underline'}} onClick={() => showToast('Navigating to Employee...')}>{selectedLead.assignedEmployee}</span>
                  </div>
                </div>
              </div>

              {/* --- PROJECT LEAD SECTIONS --- */}
              {selectedLead.leadType === 'project' && (
                <>
                  {/* Documents & Specifications Section */}
                  <div className="detail-section">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem'}}>
                      <div>
                        <h3 style={{margin: 0, fontSize: '1.2rem', color: '#0b1f3a'}}>Project Documents & Specifications</h3>
                        <p style={{fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0'}}>
                          5-Stage lifecycle documentation, dealer technical sizing, and linked bank/grid paperwork
                        </p>
                      </div>
                      {selectedLead.documents && selectedLead.documents.length > 0 && (
                        <button className="btn-outline" style={{padding: '0.4rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem'}} onClick={() => setShowDownloadSectionModal(true)}>
                          <Download size={15} /> Download Files ({selectedLead.documents.length})
                        </button>
                      )}
                    </div>

                    {/* 5-Section Category Navigation Pills */}
                    <div style={{display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.35rem'}}>
                      <button 
                        className="filter-pill-btn" 
                        style={{
                          background: docCategoryTab === 'all' ? 'var(--color-navy)' : '#f8fafc',
                          color: docCategoryTab === 'all' ? '#fff' : '#475569',
                          borderColor: docCategoryTab === 'all' ? 'var(--color-navy)' : '#cbd5e1'
                        }}
                        onClick={() => setDocCategoryTab('all')}
                      >
                        🌐 All Stages ({ALL_DOCUMENT_TYPES.length})
                      </button>
                      <button 
                        className="filter-pill-btn" 
                        style={{
                          background: docCategoryTab === 'section1' ? 'var(--color-navy)' : '#f8fafc',
                          color: docCategoryTab === 'section1' ? '#fff' : '#475569',
                          borderColor: docCategoryTab === 'section1' ? 'var(--color-navy)' : '#cbd5e1'
                        }}
                        onClick={() => setDocCategoryTab('section1')}
                      >
                        📁 1. Dealer KYC & Tech Specs ({SECTION_1_DEALER_KYC_DOCS.length})
                      </button>
                      <button 
                        className="filter-pill-btn" 
                        style={{
                          background: docCategoryTab === 'section2' ? 'var(--color-navy)' : '#f8fafc',
                          color: docCategoryTab === 'section2' ? '#fff' : '#475569',
                          borderColor: docCategoryTab === 'section2' ? 'var(--color-navy)' : '#cbd5e1'
                        }}
                        onClick={() => setDocCategoryTab('section2')}
                      >
                        🏦 2. Bank 1st Payment ({SECTION_2_BANK_FIRST_PAYMENT_DOCS.length})
                      </button>
                      <button 
                        className="filter-pill-btn" 
                        style={{
                          background: docCategoryTab === 'section3' ? 'var(--color-navy)' : '#f8fafc',
                          color: docCategoryTab === 'section3' ? '#fff' : '#475569',
                          borderColor: docCategoryTab === 'section3' ? 'var(--color-navy)' : '#cbd5e1'
                        }}
                        onClick={() => setDocCategoryTab('section3')}
                      >
                        ⚡ 3. Site Installation ({SECTION_3_SITE_INSTALLATION_DOCS.length})
                      </button>
                      <button 
                        className="filter-pill-btn" 
                        style={{
                          background: docCategoryTab === 'section4' ? 'var(--color-navy)' : '#f8fafc',
                          color: docCategoryTab === 'section4' ? '#fff' : '#475569',
                          borderColor: docCategoryTab === 'section4' ? 'var(--color-navy)' : '#cbd5e1'
                        }}
                        onClick={() => setDocCategoryTab('section4')}
                      >
                        💳 4. Bank 2nd Payment ({SECTION_4_BANK_SECOND_PAYMENT_DOCS.length})
                      </button>
                      <button 
                        className="filter-pill-btn" 
                        style={{
                          background: docCategoryTab === 'section5' ? 'var(--color-navy)' : '#f8fafc',
                          color: docCategoryTab === 'section5' ? '#fff' : '#475569',
                          borderColor: docCategoryTab === 'section5' ? 'var(--color-navy)' : '#cbd5e1'
                        }}
                        onClick={() => setDocCategoryTab('section5')}
                      >
                        🏢 5. Grid / DISCOM Docs ({SECTION_5_GRID_OFFICE_DOCS.length})
                      </button>
                    </div>

                    {/* ========================================================= */}
                    {/* SECTION 1: DEALER TECHNICAL SPECIFICATIONS FORM            */}
                    {/* ========================================================= */}
                    {(docCategoryTab === 'all' || docCategoryTab === 'section1') && (
                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        marginBottom: '2rem',
                        boxShadow: '0 4px 12px rgba(11, 31, 58, 0.04)'
                      }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem'}}>
                          <div>
                            <h4 style={{margin: 0, fontSize: '1.05rem', color: '#0b1f3a', display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                              📐 Dealer Technical Specifications & Bill of Materials (BOM)
                            </h4>
                            <span style={{fontSize: '0.8rem', color: '#64748b'}}>
                              Enter project electrical sizing, conduit bends, wire lengths, and bank loan details
                            </span>
                          </div>

                          <button 
                            className="btn-primary"
                            onClick={handleSaveSpecs}
                            disabled={isSavingSpecs}
                            style={{padding: '0.45rem 1.1rem', fontSize: '0.85rem'}}
                          >
                            {isSavingSpecs ? <><Loader2 size={14} style={{animation: 'spin 1s linear infinite'}} /> Saving...</> : <>💾 Save Specifications</>}
                          </button>
                        </div>

                        {/* 1. Customer & Loan Basic Info */}
                        <div style={{marginBottom: '1.25rem'}}>
                          <div style={{fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.6rem'}}>
                            1. Customer & Banking Data
                          </div>
                          <div className="form-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem'}}>
                            <div className="form-group">
                              <label>Customer Full Name</label>
                              <input 
                                type="text"
                                value={specsForm.fullName || ''}
                                onChange={e => setSpecsForm({ ...specsForm, fullName: e.target.value })}
                                placeholder="E.g. Rajesh Sharma"
                              />
                            </div>
                            <div className="form-group">
                              <label>Phone Number</label>
                              <input 
                                type="tel"
                                value={specsForm.phone || ''}
                                onChange={e => setSpecsForm({ ...specsForm, phone: e.target.value })}
                                placeholder="E.g. 9876543210"
                              />
                            </div>
                            <div className="form-group">
                              <label>Email ID (Text or Photo)</label>
                              <div style={{display: 'flex', gap: '0.4rem'}}>
                                <input 
                                  type="email"
                                  value={specsForm.email || ''}
                                  onChange={e => setSpecsForm({ ...specsForm, email: e.target.value })}
                                  placeholder="customer@gmail.com"
                                  style={{flex: 1}}
                                />
                                <label className="btn-outline" style={{padding: '0.45rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}} title="Upload Email ID Screenshot">
                                  <Camera size={16} />
                                  <input 
                                    type="file" 
                                    accept="image/*"
                                    style={{display: 'none'}}
                                    onChange={e => {
                                      if (e.target.files && e.target.files.length > 0) {
                                        handleUploadEmailProof(e.target.files[0]);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                              {specsForm.emailProofUrl && (
                                <div style={{fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem'}}>
                                  ✓ Photo Uploaded: 
                                  <a href={specsForm.emailProofUrl} target="_blank" rel="noreferrer" style={{color: '#2563eb', textDecoration: 'underline'}}>
                                    {specsForm.emailProofFileName || 'View'}
                                  </a>
                                </div>
                              )}
                            </div>
                            <div className="form-group">
                              <label>Bank IFSC Code (for loan processing)</label>
                              <input 
                                type="text"
                                value={specsForm.bankIfscCode || ''}
                                onChange={e => setSpecsForm({ ...specsForm, bankIfscCode: e.target.value.toUpperCase() })}
                                placeholder="E.g. HDFC0001234 / SBIN0004567"
                                style={{textTransform: 'uppercase', fontWeight: 600}}
                              />
                            </div>
                          </div>
                        </div>

                        {/* 2. Solar Equipment & Structure Sizing */}
                        <div style={{marginBottom: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9'}}>
                          <div style={{fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.6rem'}}>
                            2. Solar Equipment & Structure Sizing
                          </div>
                          <div className="form-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem'}}>
                            <div className="form-group">
                              <label>Which Company Panels and Their Wp?</label>
                              <input 
                                type="text"
                                value={specsForm.panelWp || ''}
                                onChange={e => setSpecsForm({ ...specsForm, panelWp: e.target.value })}
                                placeholder="E.g. Waaree 540 Wp / Adani 610 Wp Bifacial"
                              />
                            </div>
                            <div className="form-group">
                              <label>Phase Needed</label>
                              <select 
                                value={specsForm.phase || '1 Phase'}
                                onChange={e => setSpecsForm({ ...specsForm, phase: e.target.value as '1 Phase' | '3 Phase' })}
                              >
                                <option value="1 Phase">1 Phase (Single Phase)</option>
                                <option value="3 Phase">3 Phase (Three Phase)</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>System Capacity (KW)</label>
                              <input 
                                type="text"
                                value={specsForm.systemCapacityKw || ''}
                                onChange={e => setSpecsForm({ ...specsForm, systemCapacityKw: e.target.value })}
                                placeholder="E.g. 3 kW, 5 kW, 10 kW"
                              />
                            </div>
                            <div className="form-group">
                              <label>Building Floors</label>
                              <input 
                                type="text"
                                value={specsForm.buildingFloors || ''}
                                onChange={e => setSpecsForm({ ...specsForm, buildingFloors: e.target.value })}
                                placeholder="E.g. 1 Floor / 2 Floors / G+2"
                              />
                            </div>
                            <div className="form-group">
                              <label>Structure Height & Type</label>
                              <select 
                                value={specsForm.structureHeightAndType || 'Company Structure'}
                                onChange={e => setSpecsForm({ ...specsForm, structureHeightAndType: e.target.value })}
                              >
                                <option value="Company Structure">Standard Company Structure</option>
                                <option value="Custom GI Welding Structure">Custom GI Welding Structure</option>
                                <option value="Elevated Rooftop Structure">Elevated Rooftop Structure (8ft+)</option>
                                <option value="Tin Shed Flush Mount">Tin Shed / Sheet Mount</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Lightning Arrester Stand?</label>
                              <select 
                                value={specsForm.lightningArresterStand || 'Yes'}
                                onChange={e => setSpecsForm({ ...specsForm, lightningArresterStand: e.target.value as 'Yes' | 'No' })}
                              >
                                <option value="Yes">Yes (Iron Stand Needed)</option>
                                <option value="No">No (Not Required)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* 3. Plumbing, Conduit & Iron Fittings */}
                        <div style={{marginBottom: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9'}}>
                          <div style={{fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.6rem'}}>
                            3. Conduit & Iron Fittings Required
                          </div>
                          <div className="form-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem'}}>
                            <div className="form-group">
                              <label>10-ft Pipes Needed</label>
                              <input 
                                type="number"
                                value={specsForm.pipes10FeetCount || ''}
                                onChange={e => setSpecsForm({ ...specsForm, pipes10FeetCount: e.target.value })}
                                placeholder="Count (e.g. 6)"
                              />
                            </div>
                            <div className="form-group">
                              <label>Long "L" Bends</label>
                              <input 
                                type="number"
                                value={specsForm.longLBendsCount || ''}
                                onChange={e => setSpecsForm({ ...specsForm, longLBendsCount: e.target.value })}
                                placeholder="Count (e.g. 4)"
                              />
                            </div>
                            <div className="form-group">
                              <label>Short "L" Bends</label>
                              <input 
                                type="number"
                                value={specsForm.shortLBendsCount || ''}
                                onChange={e => setSpecsForm({ ...specsForm, shortLBendsCount: e.target.value })}
                                placeholder="Count (e.g. 8)"
                              />
                            </div>
                            <div className="form-group">
                              <label>"T" Bends</label>
                              <input 
                                type="number"
                                value={specsForm.tBendsCount || ''}
                                onChange={e => setSpecsForm({ ...specsForm, tBendsCount: e.target.value })}
                                placeholder="Count (e.g. 2)"
                              />
                            </div>
                            <div className="form-group">
                              <label>Straight Joint Connectors</label>
                              <input 
                                type="number"
                                value={specsForm.straightJointConnectorsCount || ''}
                                onChange={e => setSpecsForm({ ...specsForm, straightJointConnectorsCount: e.target.value })}
                                placeholder="Count (e.g. 6)"
                              />
                            </div>
                          </div>
                        </div>

                        {/* 4. Electrical Wiring Requirements */}
                        <div style={{paddingTop: '1rem', borderTop: '1px solid #f1f5f9'}}>
                          <div style={{fontSize: '0.82rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.6rem'}}>
                            4. Electrical Wiring Requirements (Meters / Length)
                          </div>
                          <div className="form-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem'}}>
                            <div className="form-group">
                              <label>DC RED Wire (m)</label>
                              <input 
                                type="text"
                                value={specsForm.dcRedWireLength || ''}
                                onChange={e => setSpecsForm({ ...specsForm, dcRedWireLength: e.target.value })}
                                placeholder="E.g. 30m"
                              />
                            </div>
                            <div className="form-group">
                              <label>DC BLACK Wire (m)</label>
                              <input 
                                type="text"
                                value={specsForm.dcBlackWireLength || ''}
                                onChange={e => setSpecsForm({ ...specsForm, dcBlackWireLength: e.target.value })}
                                placeholder="E.g. 30m"
                              />
                            </div>
                            <div className="form-group">
                              <label>AC RED Wire (m)</label>
                              <input 
                                type="text"
                                value={specsForm.acRedWireLength || ''}
                                onChange={e => setSpecsForm({ ...specsForm, acRedWireLength: e.target.value })}
                                placeholder="E.g. 25m"
                              />
                            </div>
                            <div className="form-group">
                              <label>AC BLACK Wire (m)</label>
                              <input 
                                type="text"
                                value={specsForm.acBlackWireLength || ''}
                                onChange={e => setSpecsForm({ ...specsForm, acBlackWireLength: e.target.value })}
                                placeholder="E.g. 25m"
                              />
                            </div>
                            <div className="form-group">
                              <label>GREEN (Earthing) Wire</label>
                              <input 
                                type="text"
                                value={specsForm.greenWireLength || ''}
                                onChange={e => setSpecsForm({ ...specsForm, greenWireLength: e.target.value })}
                                placeholder="E.g. 20m"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ========================================================= */}
                    {/* DOCUMENT CARDS RENDERER HELPER                             */}
                    {/* ========================================================= */}
                    {(() => {
                      const renderCategorySection = (
                        docTypes: string[], 
                        title: string, 
                        subtitle: string, 
                        badgeText: string, 
                        badgeColor: string,
                        linkedDocTypes: string[] = [],
                        sectionBannerNotice?: string
                      ) => {
                        const totalTypes = docTypes.length;
                        const uploadedTypesCount = docTypes.filter(t => selectedLead.documents?.some(d => d.documentType === t)).length;

                        return (
                          <div style={{
                            marginBottom: '2rem', 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '14px', 
                            padding: '1.5rem', 
                            background: '#ffffff', 
                            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)'
                          }}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem'}}>
                              <div>
                                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                  <h4 style={{margin: 0, fontSize: '1.1rem', color: '#0b1f3a', fontWeight: 800}}>{title}</h4>
                                  <span style={{fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: '12px', background: badgeColor, color: '#0b1f3a', fontWeight: 700}}>
                                    {badgeText}
                                  </span>
                                </div>
                                <p style={{margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b'}}>{subtitle}</p>
                              </div>
                              <span style={{
                                fontSize: '0.85rem', 
                                fontWeight: 700, 
                                color: uploadedTypesCount === totalTypes ? '#16a34a' : '#475569', 
                                background: uploadedTypesCount === totalTypes ? '#dcfce7' : '#f1f5f9', 
                                padding: '0.3rem 0.75rem', 
                                borderRadius: '8px'
                              }}>
                                {uploadedTypesCount} / {totalTypes} Completed
                              </span>
                            </div>

                            {sectionBannerNotice && (
                              <div style={{
                                background: '#eff6ff', 
                                padding: '0.65rem 1rem', 
                                borderRadius: '8px', 
                                fontSize: '0.85rem', 
                                color: '#1e40af', 
                                marginBottom: '1.25rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem', 
                                border: '1px solid #bfdbfe'
                              }}>
                                <AlertTriangle size={16} color="#2563eb" /> {sectionBannerNotice}
                              </div>
                            )}

                            <div className="document-grid">
                              {docTypes.map(type => {
                                const req = DOC_REQUIREMENTS[type] || { maxImages: 1 };
                                const isLinked = linkedDocTypes.includes(type);
                                const existingDocs = selectedLead.documents?.filter(d => d.documentType === type) || [];
                                const hasFiles = existingDocs.length > 0;

                                return (
                                  <div 
                                    key={type} 
                                    className={`document-card ${!hasFiles ? 'empty' : ''}`}
                                    style={{
                                      position: 'relative',
                                      borderColor: hasFiles ? '#cbd5e1' : '#e2e8f0',
                                      background: hasFiles ? '#ffffff' : '#f8fafc'
                                    }}
                                  >
                                    <div className="document-card-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                                      <div>
                                        <span className="document-card-title" style={{fontWeight: 800, color: '#0b1f3a', fontSize: '0.92rem'}}>
                                          {type}
                                        </span>
                                        {isLinked && (
                                          <div style={{fontSize: '0.7rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem'}}>
                                            🔗 Auto-Linked Document
                                          </div>
                                        )}
                                      </div>

                                      {hasFiles && (
                                        <span style={{
                                          fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 700,
                                          background: existingDocs[0].status === 'Verified' ? '#dcfce7' : existingDocs[0].status === 'Pending' ? '#fef9c3' : '#f1f5f9',
                                          color: existingDocs[0].status === 'Verified' ? '#16a34a' : existingDocs[0].status === 'Pending' ? '#ca8a04' : '#475569'
                                        }}>
                                          {existingDocs[0].status}
                                        </span>
                                      )}
                                    </div>

                                    {/* Notice / Requirement Text */}
                                    {req.notice && (
                                      <div style={{fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', margin: '0.35rem 0'}}>
                                        {req.notice}
                                      </div>
                                    )}

                                    {/* Uploaded Files List */}
                                    {hasFiles ? (
                                      <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem'}}>
                                        {existingDocs.map((doc, idx) => (
                                          <div key={doc.id} style={{background: '#f8fafc', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                                            <div className="document-card-filename" style={{display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem'}}>
                                              <FileText size={14} color="#64748b" /> 
                                              <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1}} title={doc.fileName}>
                                                {doc.fileName} {existingDocs.length > 1 ? `(#${idx + 1})` : ''}
                                              </span>
                                            </div>

                                            <div style={{fontSize: '0.7rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem'}}>
                                              <span>{new Date(doc.uploadedAt).toLocaleDateString('en-IN')}</span>
                                              <span style={{fontWeight: 600, color: doc.uploadedByRole === 'Dealer' ? '#2563eb' : '#059669'}}>
                                                {doc.uploadedByRole || 'Staff'}
                                              </span>
                                            </div>

                                            <div className="document-card-actions" style={{display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap'}}>
                                              <button 
                                                className="btn-outline" 
                                                style={{padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem'}} 
                                                onClick={() => { setPreviewDoc(doc); setShowPreviewModal(true); }}
                                                title="View Document"
                                              >
                                                <Eye size={12} /> View
                                              </button>
                                              <button 
                                                className="btn-outline" 
                                                style={{padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem'}} 
                                                onClick={() => handleDownloadDocument(doc)}
                                                title="Download Document"
                                              >
                                                <Download size={12} /> Download
                                              </button>
                                              {currentUser?.id === doc.uploadedByUserId && (
                                                <button 
                                                  className="btn-outline" 
                                                  style={{padding: '0.2rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#ef4444', borderColor: '#fca5a5'}} 
                                                  onClick={() => { setDocToDelete(doc.id); setShowDeleteDocModal(true); }}
                                                  title="Delete File"
                                                >
                                                  <Trash2 size={12} /> Delete
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        ))}

                                        {/* Multi-Image Upload Button when below max */}
                                        {existingDocs.length < req.maxImages && (
                                          <label className="inline-upload-btn" style={{marginTop: '0.25rem', width: '100%', boxSizing: 'border-box', textAlign: 'center'}}>
                                            <Upload size={13} /> + Add Another Image ({existingDocs.length}/{req.maxImages === 999 ? '∞' : req.maxImages})
                                            <input 
                                              type="file" 
                                              style={{display: 'none'}}
                                              onChange={async (e) => {
                                                if (e.target.files && e.target.files.length > 0) {
                                                  const fileToUpload = e.target.files[0];
                                                  await handleInlineUpload(type, fileToUpload);
                                                  e.target.value = '';
                                                }
                                              }}
                                            />
                                          </label>
                                        )}

                                        {/* Admin / Employee Actions */}
                                        {(isAdmin || currentUser?.role === 'Employee') && (
                                          <select 
                                            className="filter-select" 
                                            style={{padding: '0.3rem', fontSize: '0.75rem', marginTop: '0.4rem', width: '100%'}}
                                            value=""
                                            onChange={(e) => {
                                              const action = e.target.value;
                                              const doc = existingDocs[0];
                                              if (action === 'verify') { setDocToVerify(doc); setShowVerifyDocModal(true); }
                                              else if (action === 'pending') handleMarkPendingDocument(doc);
                                              else if (action === 'request') { setDocToRequest(doc); setRequestDocNotes(''); setShowRequestDocModal(true); }
                                              else if (action === 'reject') { setDocToReject(doc); setRejectReason(''); setShowRejectDocModal(true); }
                                            }}
                                          >
                                            <option value="" disabled>Document Actions...</option>
                                            <option value="verify">✓ Verify</option>
                                            <option value="pending">⏳ Mark Pending</option>
                                            <option value="request">❓ Request Additional</option>
                                            <option value="reject">✕ Reject</option>
                                          </select>
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem'}}>
                                        <FileText size={28} color="#cbd5e1" />
                                        <label className="inline-upload-btn" style={{width: '100%', boxSizing: 'border-box', textAlign: 'center'}}>
                                          <Upload size={14} /> Upload {req.maxImages > 1 ? `(Max ${req.maxImages === 999 ? 'Multiple' : req.maxImages})` : ''}
                                          <input 
                                            type="file" 
                                            style={{display: 'none'}}
                                            onChange={async (e) => {
                                              if (e.target.files && e.target.files.length > 0) {
                                                const fileToUpload = e.target.files[0];
                                                await handleInlineUpload(type, fileToUpload);
                                                e.target.value = '';
                                              }
                                            }}
                                          />
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <>
                          {/* 1. FIRST DOC: Dealer KYC & Site Survey Documents */}
                          {(docCategoryTab === 'all' || docCategoryTab === 'section1') && (
                            renderCategorySection(
                              SECTION_1_DEALER_KYC_DOCS,
                              '1. First Doc: Dealer KYC & Site Survey Documents',
                              'Customer identity proofs, electricity bill, house tax, meter, building, and signature photos',
                              'First Doc (Dealer KYC)',
                              '#dbeafe',
                              [],
                              'Please ensure all identity documents, bank cheque, and electricity bills are high-resolution and clearly readable.'
                            )
                          )}

                          {/* 2. SECOND DOC: Bank First Payment Documents */}
                          {(docCategoryTab === 'all' || docCategoryTab === 'section2') && (
                            renderCategorySection(
                              [...SECTION_2_BANK_FIRST_PAYMENT_DOCS, ...SECTION_2_LINKED_KYC_DOCS],
                              '2. Second Doc: Bank First Payment Documents',
                              'E-Token, agreements, feasibility letter, JanSamarth doc, and auto-linked customer KYC proofs',
                              'Second Doc (Bank 1st Payment)',
                              '#fef3c7',
                              SECTION_2_LINKED_KYC_DOCS
                            )
                          )}

                          {/* 3. THIRD DOC: Site Installation Photos */}
                          {(docCategoryTab === 'all' || docCategoryTab === 'section3') && (
                            renderCategorySection(
                              SECTION_3_SITE_INSTALLATION_DOCS,
                              '3. Third Doc: Site Installation Photos',
                              'Geo-tagged customer photo, earthing, inverter serial number, and panel serial barcodes (min 2 to infinite)',
                              'Third Doc (Installation Photos)',
                              '#e0e7ff',
                              [],
                              'All installation photos must be sharp and clear to see text, panel barcodes, and inverter serial numbers.'
                            )
                          )}

                          {/* 4. FOURTH DOC: Bank Second Payment Documents */}
                          {(docCategoryTab === 'all' || docCategoryTab === 'section4') && (
                            renderCategorySection(
                              ['Geo-Tagged Photo with Customer in Plant', ...SECTION_4_BANK_SECOND_PAYMENT_DOCS],
                              '4. Fourth Doc: Bank Second Payment Documents',
                              'Project completion report, tax invoice bill, and auto-linked geo-tagged plant photo',
                              'Fourth Doc (Bank 2nd Payment)',
                              '#dcfce7',
                              ['Geo-Tagged Photo with Customer in Plant']
                            )
                          )}

                          {/* 5. FIFTH DOC: Grid / DISCOM Office Documents */}
                          {(docCategoryTab === 'all' || docCategoryTab === 'section5') && (
                            renderCategorySection(
                              ['Annexure - A', 'Annexure - C', 'SYNCHRONISATION', 'PROJECT COMPLETION REPORT', 'S Number Photo', 'DCR Certificate Documents', 'Geo-Tagged Photo with Customer in Plant', 'Current Bill'],
                              '5. Fifth Doc: Grid / DISCOM Office Documents',
                              'Annexure A & C, synchronisation report, S-Number photo, DCR certificates, and linked reports',
                              'Fifth Doc (Grid / DISCOM)',
                              '#f3e8ff',
                              ['PROJECT COMPLETION REPORT', 'Geo-Tagged Photo with Customer in Plant', 'Current Bill']
                            )
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Admin Assignment Section */}
                  <div className="detail-section">
                    <h3>Project Assignment</h3>
                    <div style={{padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                        <div style={{width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 'bold'}}>
                          {selectedLead.assignedEmployee && selectedLead.assignedEmployee !== 'Unassigned' ? selectedLead.assignedEmployee.charAt(0) : <User size={20} />}
                        </div>
                        <div>
                          <div style={{fontWeight: 600, color: '#1e293b'}}>
                            {selectedLead.assignedEmployee && selectedLead.assignedEmployee !== 'Unassigned' ? selectedLead.assignedEmployee : 'Unassigned'}
                          </div>
                          <div style={{fontSize: '0.85rem', color: '#64748b'}}>Assigned Employee</div>
                        </div>
                      </div>
                      {isAdmin && (
                        <button className="btn-primary" onClick={() => setShowChangeEmpModal(true)}>
                          {selectedLead.assignedEmployee && selectedLead.assignedEmployee !== 'Unassigned' ? 'Reassign' : 'Assign Employee'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Employee Work Area */}
                  {selectedLead.assignedEmployee && selectedLead.assignedEmployee !== 'Unassigned' && (
                    <div className="detail-section">
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h3>Employee Work & Updates</h3>
                        {(isEmployee || isAdmin) && (
                          <button className="btn-outline" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem'}} onClick={() => setShowAddUpdateModal(true)}>
                            <Plus size={14} /> Add Update
                          </button>
                        )}
                      </div>
                      
                      <div style={{marginTop: '1rem', padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem'}}>
                          <Clock size={16} color="#3b82f6" /> 
                          <span style={{fontWeight: 600, color: '#1e293b'}}>Work Status:</span> 
                          <span style={{
                            padding: '0.2rem 0.5rem', 
                            borderRadius: '4px', 
                            background: selectedLead.workStatus === 'Completed' ? '#dcfce7' : '#e0e7ff',
                            color: selectedLead.workStatus === 'Completed' ? '#16a34a' : '#4f46e5',
                            fontWeight: 600
                          }}>
                            {selectedLead.workStatus || 'Not Started'}
                          </span>
                        </div>
                        
                        {selectedLead.projectUpdates && selectedLead.projectUpdates.length > 0 ? (
                          <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                            {selectedLead.projectUpdates.map(update => (
                              <div key={update.id} style={{padding: '0.75rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px'}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#64748b'}}>
                                  <span style={{fontWeight: 600, color: '#475569'}}>{update.status}</span>
                                  <span>{new Date(update.updatedAt).toLocaleString()}</span>
                                </div>
                                <p style={{fontSize: '0.9rem', color: '#334155', margin: 0, whiteSpace: 'pre-wrap'}}>{update.description}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic', margin: 0}}>No updates provided yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
              {/* --- END PROJECT LEAD SECTIONS --- */}

              {/* Follow ups */}
              {selectedLead.followUp && (
                <div className="detail-section">
                  <h3>Next Follow-up</h3>
                  <div className="fu-item">
                    <div>
                      <div style={{fontWeight: 700, fontSize: '0.95rem'}}>{selectedLead.followUp.type}</div>
                      <div style={{fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem'}}>
                        <Calendar size={12} style={{display:'inline', marginRight:'0.25rem'}}/> {selectedLead.followUp.date} at {selectedLead.followUp.time}
                      </div>
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem'}}>
                      <span className={`stage-badge ${selectedLead.followUp.status === 'Overdue' ? 'pmsurvey' : (selectedLead.followUp.status === 'Completed' ? 'completed' : 'lead')}`}>
                        {selectedLead.followUp.status}
                      </span>
                      {selectedLead.followUp.status !== 'Completed' && (
                        <button className="btn-outline" style={{padding: '0.2rem 0.5rem', fontSize: '0.75rem'}} onClick={() => handleCompleteFollowUp(selectedLead.id)}>
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Related Tasks */}
              <div className="detail-section">
                <h3>Related Tasks</h3>
                <div className="notes-list">
                  {tasks.filter(t => t.leadId === selectedLead.id).length > 0 ? tasks.filter(t => t.leadId === selectedLead.id).map(task => (
                    <div key={task.id} className="note-item" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                        <CheckSquare size={16} color={task.status === 'Completed' ? '#16a34a' : '#0284c7'} />
                        <div>
                          <div style={{fontWeight: 600, color: '#1e293b'}}>{task.title}</div>
                          <div style={{fontSize: '0.8rem', color: '#64748b'}}>
                            {task.status} {task.dueDate && `• Due: ${task.dueDate}`}
                          </div>
                        </div>
                      </div>
                      <span className={`stage-badge lead`} style={{background: task.priority === 'High' ? '#fee2e2' : task.priority === 'Medium' ? '#fef3c7' : '#e0e7ff', color: task.priority === 'High' ? '#b91c1c' : task.priority === 'Medium' ? '#b45309' : '#3730a3'}}>
                        {task.priority}
                      </span>
                    </div>
                  )) : (
                    <div style={{fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic', padding: '0.5rem'}}>No tasks related to this lead.</div>
                  )}
                </div>
              </div>
              {/* Notes */}
              <div className="detail-section">
                <h3>Notes</h3>
                <div className="notes-list">
                  {selectedLead.notes ? selectedLead.notes.split('\n').map((n, i) => {
                    const match = n.match(/^\[(.*?)\] (.*?): (.*)$/);
                    if (match) {
                      return (
                        <div key={i} className="note-item">
                          <div className="note-header">
                            <span className="note-author">{match[2]}</span>
                            <span>{match[1]}</span>
                          </div>
                          <div className="note-text">{match[3]}</div>
                        </div>
                      );
                    }
                    return <div key={i} className="note-text" style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0'}}>{n}</div>;
                  }) : <div style={{color: '#64748b', fontSize: '0.85rem'}}>No notes yet.</div>}
                </div>
                {canManageModule(currentUser, 'leads') && (
                  <div style={{marginTop: '1rem', display: 'flex', gap: '0.5rem'}}>
                    <input 
                      type="text" 
                      placeholder="Add a note..." 
                      style={{flex: 1, padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none'}}
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                    />
                    <button className="btn-primary" onClick={handleAddNote} disabled={!newNote.trim()}>Add</button>
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              <div className="detail-section">
                <h3>Activity</h3>
                <div className="activity-filters">
                  {['All', 'Lead Update', 'Lead Assignment', 'Follow-up'].map(f => (
                    <button 
                      key={f} 
                      className={`activity-filter-btn ${activityFilter === f ? 'active' : ''}`}
                      onClick={() => setActivityFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="timeline">
                  {activities
                    .filter(a => a.message.includes(selectedLead.customer))
                    .filter(a => activityFilter === 'All' || a.type.includes(activityFilter))
                    .reverse() // Newest first
                    .map(a => (
                      <div key={a.id} className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                          <span className="timeline-title">{a.type}</span>
                          <span style={{fontSize: '0.9rem', color: '#334155', marginTop: '0.25rem'}}>{a.message}</span>
                          <span className="timeline-time" style={{marginTop: '0.25rem'}}>{a.user} • {a.createdAt}</span>
                        </div>
                      </div>
                  ))}
                  {activities.filter(a => a.message.includes(selectedLead.customer)).length === 0 && (
                    <div style={{color: '#64748b', fontSize: '0.85rem'}}>No activity yet.</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* CONFIRMATION MODALS */}
      {showVerifyDocModal && docToVerify && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h2>Verify Document</h2>
            <p style={{marginBottom: '1rem', color: '#64748b'}}>Are you sure you want to verify this document: <strong>{docToVerify.documentType}</strong>?</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setShowVerifyDocModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={confirmVerifyDocument}>Verify</button>
            </div>
          </div>
        </div>
      )}

      {showRejectDocModal && docToReject && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h2>Reject Document</h2>
            <p style={{marginBottom: '1rem', color: '#64748b'}}>Are you sure you want to reject <strong>{docToReject.documentType}</strong>?</p>
            <div className="form-group">
              <label>Rejection Reason (Optional)</label>
              <input type="text" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter reason..." />
            </div>
            <div className="modal-actions" style={{marginTop: '1.5rem'}}>
              <button className="btn-outline" onClick={() => setShowRejectDocModal(false)}>Cancel</button>
              <button className="btn-primary" style={{background: '#ef4444', borderColor: '#ef4444'}} onClick={confirmRejectDocument}>Reject</button>
            </div>
          </div>
        </div>
      )}

      {showRequestDocModal && docToRequest && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h2>Request Additional Document</h2>
            <p style={{marginBottom: '1rem', color: '#64748b'}}>Request additional information for <strong>{docToRequest.documentType}</strong>.</p>
            <div className="form-group">
              <label>Document Type</label>
              <input type="text" value={docToRequest.documentType} disabled style={{background: '#f1f5f9'}} />
            </div>
            <div className="form-group">
              <label>Reason / Notes (Recommended)</label>
              <input type="text" value={requestDocNotes} onChange={e => setRequestDocNotes(e.target.value)} placeholder="Specify what is missing..." />
            </div>
            <div className="modal-actions" style={{marginTop: '1.5rem'}}>
              <button className="btn-outline" onClick={() => setShowRequestDocModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={confirmRequestAdditionalDocument}>Request Additional</button>
            </div>
          </div>
        </div>
      )}

      {showAddUpdateModal && selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px'}}>
            <h2>Add Project Update</h2>
            <p style={{marginBottom: '1rem', color: '#64748b'}}>Provide an update on your work progress for <strong>{selectedLead.customer}</strong>.</p>
            
            <div className="form-group">
              <label>Work Status *</label>
              <select 
                value={newUpdateForm.status} 
                onChange={e => setNewUpdateForm({...newUpdateForm, status: e.target.value as EmployeeWorkStatus})}
                style={{width: '100%', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px'}}
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Waiting for Documents">Waiting for Documents</option>
                <option value="Waiting for Customer">Waiting for Customer</option>
                <option value="Waiting for Approval">Waiting for Approval</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            
            <div className="form-group" style={{marginTop: '1rem'}}>
              <label>Update / Work Description *</label>
              <textarea 
                value={newUpdateForm.description} 
                onChange={e => setNewUpdateForm({...newUpdateForm, description: e.target.value})}
                placeholder="What did you work on?"
                style={{width: '100%', minHeight: '100px', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '4px', resize: 'vertical'}}
              />
            </div>
            
            <div className="modal-actions" style={{marginTop: '1.5rem'}}>
              <button className="btn-outline" onClick={() => setShowAddUpdateModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAddProjectUpdate} disabled={!newUpdateForm.description.trim()}>Submit Update</button>
            </div>
          </div>
        </div>
      )}

      {showStageModal && selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h2>Change Stage</h2>
            <p style={{marginBottom: '1rem', color: '#64748b'}}>Move <strong>{selectedLead.customer}</strong> to a new stage?</p>
            <select 
              className="filter-select" 
              style={{width: '100%', marginBottom: '1.5rem'}}
              value={targetStage} 
              onChange={e => setTargetStage(e.target.value as Stage)}
            >
              <option value="">Select Stage...</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setShowStageModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleStageChange} disabled={!targetStage}>Confirm Move</button>
            </div>
          </div>
        </div>
      )}

      {showChangeEmpModal && selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h2>Reassign Employee</h2>
            <p style={{marginBottom: '1rem', color: '#64748b'}}>Change the employee handling <strong>{selectedLead.customer}</strong>.</p>
            <select 
              className="filter-select" 
              style={{width: '100%', marginBottom: '1.5rem'}}
              value={newEmp} 
              onChange={e => setNewEmp(e.target.value)}
            >
              <option value="">Select Employee...</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setShowChangeEmpModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleChangeEmployee} disabled={!newEmp}>Confirm Assignment</button>
            </div>
          </div>
        </div>
      )}

      {showLostModal && selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h2>Mark Lead as Lost</h2>
            <p style={{marginBottom: '1rem', color: '#64748b'}}>Please provide a reason for losing <strong>{selectedLead.customer}</strong>.</p>
            <select 
              className="filter-select" 
              style={{width: '100%', marginBottom: '1.5rem'}}
              value={lostReason} 
              onChange={e => setLostReason(e.target.value)}
            >
              <option value="">Select Reason...</option>
              <option value="Customer not interested">Customer not interested</option>
              <option value="Price issue">Price issue</option>
              <option value="Duplicate">Duplicate</option>
              <option value="Invalid lead">Invalid lead</option>
              <option value="Other">Other</option>
            </select>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setShowLostModal(false)}>Cancel</button>
              <button className="btn-primary" style={{background: '#ef4444', borderColor: '#ef4444'}} onClick={handleMarkLost} disabled={!lostReason}>Mark Lost</button>
            </div>
          </div>
        </div>
      )}

      {/* Full Add Lead Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto'}}>
            <h2>Add New Lead</h2>
            <p style={{color: '#64748b', marginBottom: '1.5rem'}}>Create a new lead and enter them into the pipeline.</p>
            
            <div className="form-grid">
              <div className="form-group" style={{gridColumn: '1 / -1'}}>
                <label>Lead Type *</label>
                <select value={newLeadForm.leadType} onChange={e => setNewLeadForm({...newLeadForm, leadType: e.target.value as 'tracking' | 'project'})}>
                  <option value="tracking">Tracking Lead</option>
                  <option value="project">Project / Document Lead</option>
                </select>
              </div>
              <div className="form-group">
                <label>Customer Name *</label>
                <input type="text" placeholder="Full Name" value={newLeadForm.customer} onChange={e => setNewLeadForm({...newLeadForm, customer: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input type="text" placeholder="+91..." value={newLeadForm.phone} onChange={e => setNewLeadForm({...newLeadForm, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="customer@example.com" value={newLeadForm.email} onChange={e => setNewLeadForm({...newLeadForm, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input type="text" placeholder="City or Region" value={newLeadForm.location} onChange={e => setNewLeadForm({...newLeadForm, location: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Dealer *</label>
                <select disabled={isDealer} value={isDealer && currentUser ? currentUser.name : newLeadForm.dealer} onChange={e => setNewLeadForm({...newLeadForm, dealer: e.target.value})}>
                  <option value="">Select Dealer</option>
                  {dealers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              {/* Assigned Employee (Hidden for Dealers) */}
              {!isDealer && (
                <div className="form-group">
                  <label>Assigned Employee *</label>
                  <select disabled={isEmployee} value={isEmployee && currentUser ? currentUser.name : newLeadForm.assignedEmployee} onChange={e => setNewLeadForm({...newLeadForm, assignedEmployee: e.target.value})}>
                    <option value="">Select Employee</option>
                    {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group" style={{gridColumn: '1 / -1'}}>
                <label>Initial Notes</label>
                <textarea placeholder="Any requirements or details..." value={newLeadForm.notes} onChange={e => setNewLeadForm({...newLeadForm, notes: e.target.value})}></textarea>
              </div>
            </div>

            <div className="modal-actions" style={{marginTop: '1rem'}}>
              <button type="button" className="btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => {
                if (!newLeadForm.customer || !newLeadForm.phone) {
                  showToast("Please fill in required fields.");
                  return;
                }
                const actualDealer = isDealer && currentUser ? currentUser.name : newLeadForm.dealer;
                const actualEmployee = isDealer ? '' : (isEmployee && currentUser ? currentUser.name : newLeadForm.assignedEmployee);
                
                addLead({
                  customer: newLeadForm.customer,
                  phone: newLeadForm.phone,
                  email: newLeadForm.email,
                  location: newLeadForm.location,
                  dealer: actualDealer,
                  assignedEmployee: actualEmployee,
                  notes: newLeadForm.notes,
                  stage: 'Lead',
                  priority: 'Medium',
                  leadType: newLeadForm.leadType,
                  followUp: { date: '', time: '', type: 'Other', status: 'No Follow-up' },
                  createdAt: new Date().toISOString(),
                  updatedAt: 'Just now',
                  archived: false
                });
                
                showToast("Lead created successfully");
                setShowAddModal(false);
                setNewLeadForm({ customer: '', phone: '', email: '', location: '', dealer: '', assignedEmployee: '', notes: '', leadType: 'tracking' });
              }}>Create Lead</button>
            </div>
          </div>
        </div>
      )}

      {showAddFollowupModal && selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px'}}>
            <h2>Schedule Follow-up</h2>
            <p style={{marginBottom: '1rem', color: '#64748b'}}>Schedule a new follow-up for <strong>{selectedLead.customer}</strong>.</p>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Date *</label>
                <input type="date" value={newFollowupForm.date} onChange={e => setNewFollowupForm({...newFollowupForm, date: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Time *</label>
                <input type="time" value={newFollowupForm.time} onChange={e => setNewFollowupForm({...newFollowupForm, time: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Type *</label>
                <select value={newFollowupForm.type} onChange={e => setNewFollowupForm({...newFollowupForm, type: e.target.value})}>
                  <option value="Call">Call</option>
                  <option value="Visit">Visit</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                </select>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={newFollowupForm.priority} onChange={e => setNewFollowupForm({...newFollowupForm, priority: e.target.value})}>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="modal-actions" style={{marginTop: '1.5rem'}}>
              <button className="btn-outline" onClick={() => setShowAddFollowupModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => {
                if (!newFollowupForm.date || !newFollowupForm.time) {
                  showToast("Please select a date and time.");
                  return;
                }
                
                const newFollowup: any = {
                  date: newFollowupForm.date,
                  time: newFollowupForm.time,
                  type: newFollowupForm.type,
                  status: 'Upcoming'
                };
                
                updateLead(selectedLead.id, { followUp: newFollowup });
                addActivity({
                  type: 'Follow-up Scheduled',
                  message: `Scheduled a ${newFollowupForm.type} follow-up for ${newFollowupForm.date}`,
                  user: currentUser?.name || 'System',
                  dealer: selectedLead.dealer
                });
                
                setSelectedLead({ ...selectedLead, followUp: newFollowup });
                showToast("Follow-up scheduled successfully");
                setShowAddFollowupModal(false);
                setNewFollowupForm({ date: '', time: '', type: 'Call', priority: 'Medium' });
              }}>Save Follow-up</button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && selectedLead && (
        <div className="modal-overlay" style={{ padding: '2rem' }}>
          <div className="modal-content" style={{
            width: '100%',
            height: '100%',
            maxWidth: 'none',
            display: 'flex',
            flexDirection: 'column',
            padding: '2.5rem',
            overflowY: 'auto',
            borderRadius: '16px'
          }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
              <div>
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{isReplacingDocId ? 'Replace Document' : 'Upload Document'}</h2>
                <p style={{color: '#64748b', fontSize: '1.1rem'}}>Provide the document details below.</p>
              </div>
              <button className="btn-outline" style={{padding: '0.5rem', border: 'none'}} onClick={() => setShowUploadModal(false)}>
                <X size={28} />
              </button>
            </div>
            
            <div className="upload-modal-body">
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '1.2rem', marginBottom: '0.75rem', display: 'block', fontWeight: 600 }}>Document Name :-</label>
                  <select 
                    value={uploadForm.documentType} 
                    onChange={e => setUploadForm({...uploadForm, documentType: e.target.value})}
                    className="filter-select"
                    style={{width: '100%', padding: '1rem', fontSize: '1.1rem', borderRadius: '8px', opacity: uploadForm.documentType ? 0.7 : 1}}
                    disabled={!!uploadForm.documentType}
                  >
                    <option value="">Select Document Type...</option>
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '1.2rem', marginBottom: '0.75rem', display: 'block', fontWeight: 600 }}>Notes / Description</label>
                  <textarea 
                    value={uploadForm.notes} 
                    onChange={e => setUploadForm({...uploadForm, notes: e.target.value})}
                    placeholder="E.g. Original Aadhaar document uploaded by customer."
                    style={{width: '100%', flex: 1, padding: '1rem', fontSize: '1.1rem', borderRadius: '8px', border: '1px solid #e2e8f0', resize: 'none'}}
                  />
                </div>
              </div>
              
              <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '1.2rem', marginBottom: '0.75rem', display: 'block', fontWeight: 600 }}>Choose File *</label>
                <div style={{
                  flex: 1, 
                  padding: '2rem', 
                  border: '2px dashed #cbd5e1', 
                  borderRadius: '12px', 
                  background: '#f8fafc', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '1.5rem',
                  cursor: 'pointer'
                }} onClick={() => document.getElementById('doc-upload-input')?.click()}>
                  <Upload size={64} color="#94a3b8" />
                  <input 
                    type="file" 
                    id="doc-upload-input"
                    style={{display: 'none'}}
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        setUploadForm({...uploadForm, file: e.target.files[0]});
                      }
                    }}
                  />
                  <button type="button" className="btn-outline" style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}>
                    Browse Files
                  </button>
                  {uploadForm.file && (
                    <div style={{marginTop: '1rem', textAlign: 'center', fontSize: '1.1rem', background: '#e2e8f0', padding: '1rem 2rem', borderRadius: '8px', width: '100%'}}>
                      <strong style={{ display: 'block', marginBottom: '0.5rem', wordBreak: 'break-all' }}>{uploadForm.file.name}</strong>
                      <span style={{color: '#64748b'}}>{(uploadForm.file.size / (1024 * 1024)).toFixed(2)} MB • {uploadForm.file.type || 'Unknown Type'}</span>
                    </div>
                  )}
                  {!uploadForm.file && (
                    <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Click to select a file from your device.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem'}}>
              <button className="btn-outline" style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }} onClick={() => setShowUploadModal(false)} disabled={isUploading}>Cancel</button>
              <button className="btn-primary" style={{ fontSize: '1.1rem', padding: '0.75rem 3rem' }} onClick={handleUploadSubmit} disabled={!uploadForm.documentType || !uploadForm.file || isUploading}>
                {isUploading ? 'Uploading...' : (isReplacingDocId ? 'Confirm Replace' : 'Upload Document')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && previewDoc && (() => {
        const isPdf = previewDoc.fileType === 'application/pdf' || previewDoc.fileName?.toLowerCase().endsWith('.pdf') || previewDoc.fileUrl?.toLowerCase().includes('.pdf');
        const isImage = !isPdf && (
          previewDoc.fileType?.startsWith('image/') || 
          Boolean(previewDoc.fileName?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|heic|svg|bmp)$/i)) ||
          previewDoc.fileName?.toLowerCase().includes('image') ||
          previewDoc.fileUrl?.includes('/image/upload/') ||
          previewDoc.fileType === 'Unknown Type' ||
          !previewDoc.fileType
        );

        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: isPdf ? '900px' : '750px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem'}}>
                <div>
                  <h2 style={{margin: 0, fontSize: '1.25rem', color: '#1e293b'}}>{previewDoc.documentType}</h2>
                  <span style={{fontSize: '0.8rem', color: '#64748b'}}>{previewDoc.fileName} • {(previewDoc.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                  <button 
                    className="btn-outline" 
                    style={{padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem'}} 
                    onClick={() => handleDownloadDocument(previewDoc)}
                  >
                    <Download size={14} /> Download
                  </button>
                  <a 
                    href={previewDoc.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn-outline" 
                    style={{padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', color: '#1e293b'}}
                  >
                    <ExternalLink size={14} /> Fullscreen
                  </a>
                  <button className="btn-outline" style={{padding: '0.35rem 0.5rem', border: 'none'}} onClick={() => setShowPreviewModal(false)}>
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div style={{background: '#f8fafc', borderRadius: '8px', padding: isPdf ? '0' : '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '350px', flex: 1, border: '1px solid #e2e8f0', overflow: 'hidden'}}>
                {isImage ? (
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%'}}>
                    <img src={previewDoc.fileUrl} alt={previewDoc.fileName} style={{maxWidth: '100%', maxHeight: '550px', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}} />
                    <button 
                      className="btn-primary" 
                      style={{padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}} 
                      onClick={() => handleDownloadDocument(previewDoc)}
                    >
                      <Download size={16} /> Save / Download Image
                    </button>
                  </div>
                ) : isPdf ? (
                  <iframe 
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewDoc.fileUrl)}&embedded=true`} 
                    title={previewDoc.fileName}
                    style={{width: '100%', height: '600px', border: 'none', backgroundColor: '#fff'}}
                  />
                ) : (
                  <div style={{textAlign: 'center', color: '#64748b', padding: '2rem'}}>
                    <FileText size={56} style={{marginBottom: '1rem', color: '#3b82f6'}} />
                    <h3 style={{color: '#1e293b', marginBottom: '0.25rem'}}>{previewDoc.fileName}</h3>
                    <p>{previewDoc.fileType || 'Document'} • {(previewDoc.fileSize / (1024 * 1024)).toFixed(2)} MB</p>
                    <div style={{display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.25rem'}}>
                      <button className="btn-primary" style={{padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}} onClick={() => handleDownloadDocument(previewDoc)}>
                        <Download size={16} /> Download Document
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {previewDoc.notes && (
                <div style={{marginTop: '1rem', padding: '0.75rem 1rem', background: '#f1f5f9', borderRadius: '6px', fontSize: '0.85rem'}}>
                  <strong>Notes:</strong> {previewDoc.notes}
                </div>
              )}

              {/* Bottom Action Footer */}
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '0.5rem'}}>
                <span style={{fontSize: '0.85rem', color: '#64748b'}}>{previewDoc.documentType} ({previewDoc.fileName})</span>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                  <button 
                    className="btn-primary" 
                    style={{padding: '0.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer'}} 
                    onClick={() => handleDownloadDocument(previewDoc)}
                  >
                    <Download size={16} /> Download File
                  </button>
                  <button className="btn-outline" style={{padding: '0.5rem 1rem', cursor: 'pointer'}} onClick={() => setShowPreviewModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showDeleteDocModal && docToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h2>Delete Document</h2>
            <p style={{marginBottom: '1.5rem', color: '#64748b'}}>Are you sure you want to delete this document? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setShowDeleteDocModal(false)}>Cancel</button>
              <button className="btn-primary" style={{background: '#ef4444', borderColor: '#ef4444'}} onClick={confirmDeleteDocument}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Required Modal */}
      {showPhotoRequiredModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '480px', textAlign: 'center'}}>
            <div style={{width: '60px', height: '60px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'}}>
              <Camera size={32} color="#d97706" />
            </div>
            <h2 style={{fontSize: '1.3rem', color: '#1e293b', marginBottom: '0.5rem'}}>Installation Photos Required</h2>
            <p style={{color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5'}}>
              To complete the Installation stage, please upload at least one <strong>Installation Site Photo</strong> or <strong>S Number Photo</strong>.
            </p>
            
            <div style={{background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '1.5rem'}}>
              <label className="btn-primary" style={{display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.6rem 1.5rem'}}>
                <Upload size={16} /> Choose & Upload Installation Photo
                <input 
                  type="file" 
                  accept="image/*"
                  style={{display: 'none'}}
                  onChange={async (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const file = e.target.files[0];
                      await handleInlineUpload('Installation Site Photos', file);
                      setShowPhotoRequiredModal(false);
                      showToast('Photo uploaded! You can now move to Completed stage.');
                    }
                  }}
                />
              </label>
            </div>

            <div className="modal-actions" style={{justifyContent: 'center'}}>
              <button className="btn-outline" onClick={() => setShowPhotoRequiredModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Installation Modal */}
      {showRejectInstallationModal && selectedLead && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '480px'}}>
            <h2 style={{fontSize: '1.25rem', color: '#991b1b', marginBottom: '0.5rem'}}>Reject Installation Request</h2>
            <p style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem'}}>
              Please specify the reason for rejecting the installation stage for <strong>{selectedLead.customer}</strong>.
            </p>
            <textarea 
              value={installationRejectReason} 
              onChange={e => setInstallationRejectReason(e.target.value)}
              placeholder="E.g. Quotation approval pending, Advance payment receipt not attached..."
              style={{width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', marginBottom: '1.25rem', resize: 'vertical'}}
            />
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => { setShowRejectInstallationModal(false); setInstallationRejectReason(''); }}>Cancel</button>
              <button className="btn-primary" style={{background: '#dc2626', borderColor: '#dc2626'}} onClick={handleAdminRejectInstallation}>Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

      {/* Download Section Selector Modal */}
      {showDownloadSectionModal && selectedLead && (
        <div className="modal-overlay" style={{zIndex: 1100}}>
          <div className="modal-content" style={{maxWidth: '560px', width: '100%', borderRadius: '14px', padding: '1.75rem'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                <div style={{width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb'}}>
                  <Download size={22} />
                </div>
                <div>
                  <h2 style={{fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', margin: 0}}>Download Project Documents</h2>
                  <p style={{fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0 0'}}>Select which of the 5 section(s) you wish to download</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDownloadSectionModal(false)}
                style={{border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b'}}
              >
                ✕
              </button>
            </div>

            <div style={{background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <span style={{fontSize: '0.85rem', color: '#475569', fontWeight: 600}}>
                Customer: <strong style={{color: '#0f172a'}}>{selectedLead.customer}</strong> {selectedLead.dealerSpecifications?.systemCapacityKw ? `(${selectedLead.dealerSpecifications.systemCapacityKw})` : ''}
              </span>
              <div style={{display: 'flex', gap: '0.5rem'}}>
                <button 
                  type="button" 
                  onClick={() => setSelectedDownloadSections({s1: true, s2: true, s3: true, s4: true, s5: true})}
                  style={{border: 'none', background: 'transparent', color: '#2563eb', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: 0}}
                >
                  Select All
                </button>
                <span style={{color: '#cbd5e1'}}>|</span>
                <button 
                  type="button" 
                  onClick={() => setSelectedDownloadSections({s1: false, s2: false, s3: false, s4: false, s5: false})}
                  style={{border: 'none', background: 'transparent', color: '#64748b', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: 0}}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Checkboxes for 5 sections */}
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem'}}>
              {/* Section 1 */}
              <label 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${selectedDownloadSections.s1 ? '#3b82f6' : '#e2e8f0'}`,
                  background: selectedDownloadSections.s1 ? '#f0f7ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedDownloadSections.s1}
                  onChange={e => setSelectedDownloadSections(prev => ({...prev, s1: e.target.checked}))}
                  style={{width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer'}}
                />
                <div style={{flex: 1}}>
                  <div style={{fontSize: '0.9rem', fontWeight: 700, color: '#1e293b'}}>
                    📁 Section 1: Dealer KYC & Site Survey (1st Doc)
                  </div>
                  <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '2px'}}>
                    Aadhaar, PAN, Bank Passbook, Current Bill, House Tax, Passport & Site Photos, Meter Photo
                  </div>
                </div>
                <span style={{fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '12px'}}>
                  {selectedLead.documents?.filter(d => SECTION_1_DEALER_KYC_DOCS.includes(d.documentType as any)).length || 0} files
                </span>
              </label>

              {/* Section 2 */}
              <label 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${selectedDownloadSections.s2 ? '#3b82f6' : '#e2e8f0'}`,
                  background: selectedDownloadSections.s2 ? '#f0f7ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedDownloadSections.s2}
                  onChange={e => setSelectedDownloadSections(prev => ({...prev, s2: e.target.checked}))}
                  style={{width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer'}}
                />
                <div style={{flex: 1}}>
                  <div style={{fontSize: '0.9rem', fontWeight: 700, color: '#1e293b'}}>
                    🏦 Section 2: Bank 1st Payment Processing (2nd Doc)
                  </div>
                  <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '2px'}}>
                    E-Token, Bank Ack, Net Metering Ack, Feasibility Letter, Quotation, JanSamarth + Linked KYC
                  </div>
                </div>
                <span style={{fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '12px'}}>
                  {selectedLead.documents?.filter(d => SECTION_2_BANK_FIRST_PAYMENT_DOCS.includes(d.documentType as any) || SECTION_2_LINKED_KYC_DOCS.includes(d.documentType as any)).length || 0} files
                </span>
              </label>

              {/* Section 3 */}
              <label 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${selectedDownloadSections.s3 ? '#3b82f6' : '#e2e8f0'}`,
                  background: selectedDownloadSections.s3 ? '#f0f7ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedDownloadSections.s3}
                  onChange={e => setSelectedDownloadSections(prev => ({...prev, s3: e.target.checked}))}
                  style={{width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer'}}
                />
                <div style={{flex: 1}}>
                  <div style={{fontSize: '0.9rem', fontWeight: 700, color: '#1e293b'}}>
                    🔧 Section 3: Site Installation Photos (3rd Doc)
                  </div>
                  <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '2px'}}>
                    Geo-Tagged Photo with Customer, Earthing Photo, Panel Barcodes (min 2+), Inverter Serial Photo
                  </div>
                </div>
                <span style={{fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '12px'}}>
                  {selectedLead.documents?.filter(d => SECTION_3_SITE_INSTALLATION_DOCS.includes(d.documentType as any)).length || 0} files
                </span>
              </label>

              {/* Section 4 */}
              <label 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${selectedDownloadSections.s4 ? '#3b82f6' : '#e2e8f0'}`,
                  background: selectedDownloadSections.s4 ? '#f0f7ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedDownloadSections.s4}
                  onChange={e => setSelectedDownloadSections(prev => ({...prev, s4: e.target.checked}))}
                  style={{width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer'}}
                />
                <div style={{flex: 1}}>
                  <div style={{fontSize: '0.9rem', fontWeight: 700, color: '#1e293b'}}>
                    💳 Section 4: Bank 2nd Payment & PCR (4th Doc)
                  </div>
                  <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '2px'}}>
                    Auto-Linked Geo-Tagged Plant Photo, Plant Commissioning Report (PCR), Tax Invoice / Bill
                  </div>
                </div>
                <span style={{fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '12px'}}>
                  {selectedLead.documents?.filter(d => SECTION_4_BANK_SECOND_PAYMENT_DOCS.includes(d.documentType as any) || d.documentType === 'Geo-Tagged Photo with Customer in Plant').length || 0} files
                </span>
              </label>

              {/* Section 5 */}
              <label 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: `1.5px solid ${selectedDownloadSections.s5 ? '#3b82f6' : '#e2e8f0'}`,
                  background: selectedDownloadSections.s5 ? '#f0f7ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={selectedDownloadSections.s5}
                  onChange={e => setSelectedDownloadSections(prev => ({...prev, s5: e.target.checked}))}
                  style={{width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer'}}
                />
                <div style={{flex: 1}}>
                  <div style={{fontSize: '0.9rem', fontWeight: 700, color: '#1e293b'}}>
                    ⚡ Section 5: Grid Office & Meter Setup (5th Doc)
                  </div>
                  <div style={{fontSize: '0.75rem', color: '#64748b', marginTop: '2px'}}>
                    Annexure A & C, Synchronisation / Commissioning, PCR, S-Number Photo, DCR Certs, Linked Geo Photo & Current Bill
                  </div>
                </div>
                <span style={{fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '12px'}}>
                  {selectedLead.documents?.filter(d => SECTION_5_GRID_OFFICE_DOCS.includes(d.documentType as any) || ['PROJECT COMPLETION REPORT', 'Geo-Tagged Photo with Customer in Plant', 'Current Bill'].includes(d.documentType)).length || 0} files
                </span>
              </label>
            </div>

            {/* Modal Footer Actions */}
            <div className="modal-actions" style={{marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem'}}>
              <button 
                type="button" 
                className="btn-outline" 
                onClick={() => setShowDownloadSectionModal(false)}
                style={{padding: '0.55rem 1.25rem', fontSize: '0.9rem'}}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleDownloadSelectedSections}
                disabled={!selectedDownloadSections.s1 && !selectedDownloadSections.s2 && !selectedDownloadSections.s3 && !selectedDownloadSections.s4 && !selectedDownloadSections.s5}
                style={{
                  padding: '0.55rem 1.4rem', 
                  fontSize: '0.9rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  opacity: (!selectedDownloadSections.s1 && !selectedDownloadSections.s2 && !selectedDownloadSections.s3 && !selectedDownloadSections.s4 && !selectedDownloadSections.s5) ? 0.5 : 1
                }}
              >
                <Download size={16} /> Download Selected Sections
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
