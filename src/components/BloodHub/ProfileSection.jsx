import { useState, useEffect } from 'react';
import { auth, db, storage } from '../utils/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, User, Calendar, MapPin, Phone, Droplet, Clock, X } from 'lucide-react';

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function ProfileSection({ userProfile }) {
  const [user, setUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone: '',
    photo: '',
    bloodType: '',
    dob: '',
    lastDonated: '',
    address: '',
    city: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        let userData = {
          name: currentUser.displayName || 'User',
          email: currentUser.email,
          phone: currentUser.phoneNumber || 'Not provided',
          photo: currentUser.photoURL || null,
          bloodType: '',
          dob: '',
          lastDonated: '',
          address: '',
          city: ''
        };

        if (userDoc.exists()) {
          const firebaseData = userDoc.data();
          userData = {
            ...userData,
            name: firebaseData.name || userData.name,
            phone: firebaseData.phone || userData.phone,
            bloodType: firebaseData.bloodType || userData.bloodType,
            dob: firebaseData.dob || userData.dob,
            lastDonated: firebaseData.lastDonated || userData.lastDonated,
            address: firebaseData.address || userData.address,
            city: firebaseData.city || userData.city
          };
        }

        setUser(userData);
        setEditData(userData);
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    };

    fetchUserProfile();
  }, [userProfile]);

  useEffect(() => {
    if (showEditModal) {
      setTimeout(() => setAnimateIn(true), 10);
    } else {
      setAnimateIn(false);
    }
  }, [showEditModal]);

  if (!user) return (
    <div className="py-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-gray-200 h-12 w-12"></div>
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handleEditProfile = () => {
    setShowEditModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      // Create a preview for the user to see before upload
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return null;
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No user authenticated");
      
      // Create a unique filename to avoid collisions
      const fileName = `profile_${Date.now()}_${imageFile.name}`;
      const storageRef = ref(storage, `profileImages/${currentUser.uid}/${fileName}`);
      
      console.log("Uploading image to:", storageRef);
      const snapshot = await uploadBytes(storageRef, imageFile);
      console.log("Upload complete, getting URL");
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log("Image URL retrieved:", downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error("Error in uploadImage function:", error);
      throw new Error(`Image upload failed: ${error.message}`);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No user logged in');

      // Upload image if one was selected
      let photoURL = editData.photo;
    if (imageFile) {
      try {
        photoURL = await uploadImage();
        console.log("Image uploaded successfully:", photoURL);
      } catch (imageError) {
        console.error("Image upload failed:", imageError);
        throw new Error("Failed to upload profile image");
      }
    }

      // Update Firebase Auth profile (only name and photo)
      try {
        await updateProfile(currentUser, {
          displayName: editData.name,
          photoURL: photoURL || null,
        });
        console.log("Auth profile updated");
      } catch (profileError) {
        console.error("Auth profile update failed:", profileError);
        throw new Error("Failed to update authentication profile");
      }

      // Update Firestore document with all the user data
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
          name: editData.name,
          phone: editData.phone,
          photoURL: photoURL || null,
          bloodType: editData.bloodType,
          dob: editData.dob,
          lastDonated: editData.lastDonated,
          address: editData.address,
          city: editData.city,
          updatedAt: new Date().toISOString(),
        });
        console.log("Firestore profile updated");
      } catch (firestoreError) {
        console.error("Firestore update failed:", firestoreError);
        throw new Error("Failed to update user data in database");
      }

      // Update local state
      setUser({
        ...user,
        ...editData,
        photo: photoURL || editData.photo
      });
      
      setSuccess('Profile updated successfully!');
      setTimeout(() => {
        setShowEditModal(false);
        setSuccess('');
      }, 1500);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error('Error updating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    setAnimateIn(false);
    setTimeout(() => {
      setShowEditModal(false);
      setImagePreview(null);
      setImageFile(null);
    }, 300);
  };

  // Calculate last donation date in human readable format
  const getLastDonationText = () => {
    if (!user.lastDonated) return 'No donations recorded';
    
    const lastDate = new Date(user.lastDonated);
    const today = new Date();
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays/30)} months ago`;
    return `${Math.floor(diffDays/365)} years ago`;
  };

  return (
    <section className="py-10">
      <div className="container mx-auto px-4 max-w-4xl">
        <h2 className="text-3xl font-bold mb-6">Donor Profile</h2>
        
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Profile header with avatar and basic info */}
          <div className="p-6 md:p-8 bg-gradient-to-r from-red-600 to-red-700 text-white">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
              <div className="relative">
                {user.photo ? (
                  <img 
                    src={user.photo} 
                    alt="Profile" 
                    className="h-24 w-24 rounded-full border-4 border-white object-cover" 
                  />
                ) : (
                  <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center text-red-600 font-bold text-2xl border-4 border-white">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-bold">{user.name}</h3>
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 mt-2 text-red-100">
                  <div className="flex items-center justify-center md:justify-start gap-1">
                    <User size={16} />
                    <span>{user.email}</span>
                  </div>
                  {user.phone && user.phone !== 'Not provided' && (
                    <div className="flex items-center justify-center md:justify-start gap-1">
                      <Phone size={16} />
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Profile body with detailed information */}
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left column - Blood donation info */}
              <div>
                <h4 className="text-lg font-semibold mb-4 text-gray-700">Blood Donation Details</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-red-50 p-2 rounded-full text-red-600">
                      <Droplet size={20} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Blood Type</p>
                      <p className="font-medium">{user.bloodType || 'Not specified'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="bg-red-50 p-2 rounded-full text-red-600">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Donation</p>
                      <p className="font-medium">{getLastDonationText()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="text-lg font-semibold mb-4 text-gray-700">Personal Information</h4>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-50 p-2 rounded-full text-red-600">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Date of Birth</p>
                        <p className="font-medium">{user.dob || 'Not specified'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="bg-red-50 p-2 rounded-full text-red-600">
                        <MapPin size={20} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Location</p>
                        <p className="font-medium">{user.city || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right column - Donation stats (placeholder for now) */}
              <div>
                <h4 className="text-lg font-semibold mb-4 text-gray-700">Donation Statistics</h4>
                <div className="bg-gray-50 p-6 rounded-xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <p className="text-gray-500 text-sm">Total Donations</p>
                      <p className="text-2xl font-bold text-red-600">0</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <p className="text-gray-500 text-sm">Lives Saved</p>
                      <p className="text-2xl font-bold text-red-600">0</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <p className="text-gray-500 text-sm">Last Donation</p>
                      <p className="text-2xl font-bold text-red-600">-</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <p className="text-gray-500 text-sm">Eligibility</p>
                      <p className="text-lg font-bold text-green-600">Eligible</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="text-lg font-semibold mb-4 text-gray-700">Upcoming Events</h4>
                  <div className="bg-gray-50 p-6 rounded-xl text-center">
                    <p className="text-gray-500">No upcoming blood drives in your area</p>
                    <button className="mt-4 text-red-600 font-medium hover:text-red-700 transition-colors">
                      Find blood drives
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-center">
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
                onClick={handleEditProfile}
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Edit Profile Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div 
              className={`bg-white rounded-xl shadow-xl max-w-lg w-full transform transition-all duration-300 ${
                animateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold">Edit Profile</h3>
                  <button 
                    onClick={handleClose} 
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 p-1 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm border border-green-100">
                    {success}
                  </div>
                )}

                <div className="space-y-6">
                  {/* Profile Photo Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Profile Photo</label>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {imagePreview ? (
                          <img 
                            src={imagePreview} 
                            alt="Profile Preview" 
                            className="h-16 w-16 rounded-full object-cover border border-gray-300" 
                          />
                        ) : user.photo ? (
                          <img 
                            src={user.photo} 
                            alt="Current Profile" 
                            className="h-16 w-16 rounded-full object-cover border border-gray-300" 
                          />
                        ) : (
                          <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold text-xl border border-gray-300">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        
                        <label htmlFor="profile-photo-upload" className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md cursor-pointer border border-gray-200 hover:bg-gray-50">
                          <Camera size={16} className="text-gray-600" />
                          <input 
                            id="profile-photo-upload" 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleFileChange}
                          />
                        </label>
                      </div>
                      
                      <div className="flex-1">
                        <p className="text-sm text-gray-500">Upload a new photo or use an image URL</p>
                        <input
                          type="text"
                          name="photo"
                          value={editData.photo || ''}
                          onChange={handleChange}
                          placeholder="Image URL (optional)"
                          className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={editData.name}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={editData.email}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg p-2 bg-gray-100"
                        disabled
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>     
                      <input
                        type="tel"
                        name="phone"
                        value={editData.phone}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                      <select
                        name="bloodType"
                        value={editData.bloodType}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      >
                        <option value="">Select Blood Type</option>
                        {bloodTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        name="dob"
                        value={editData.dob || ''}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Donated On</label>
                      <input
                        type="date"
                        name="lastDonated"
                        value={editData.lastDonated || ''}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        name="city"
                        value={editData.city || ''}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      name="address"
                      value={editData.address || ''}
                      onChange={handleChange}
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      rows="2"
                    ></textarea>
                  </div>
                </div>
                
                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors font-medium flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}