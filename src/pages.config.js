import AdminAuditLog from './pages/AdminAuditLog';
import AdminDataCleanup from './pages/AdminDataCleanup';
import AdminDataImport from './pages/AdminDataImport';
import AdminDataMaintenance from './pages/AdminDataMaintenance';
import AdminDeduplicateVarieties from './pages/AdminDeduplicateVarieties';
import AdminLog from './pages/AdminLog';
import BrowseCategoryConfig from './pages/BrowseCategoryConfig';
import BrowseGardens from './pages/BrowseGardens';
import Calendar from './pages/Calendar';
import CalendarPlanner from './pages/CalendarPlanner';
import CalendarTasks from './pages/CalendarTasks';
import ChangeRequests from './pages/ChangeRequests';
import Community from './pages/Community';
import CommunityBoard from './pages/CommunityBoard';
import CompanionPlanner from './pages/CompanionPlanner';
import CompanionRuleImport from './pages/CompanionRuleImport';
import CompanionRulesAudit from './pages/CompanionRulesAudit';
import Dashboard from './pages/Dashboard';
import EditPlantType from './pages/EditPlantType';
import EditVariety from './pages/EditVariety';
import EditorReviewQueue from './pages/EditorReviewQueue';
import FeatureRequests from './pages/FeatureRequests';
import ForumAdmin from './pages/ForumAdmin';
import ForumCategory from './pages/ForumCategory';
import ForumTopic from './pages/ForumTopic';
import GardenBuilder from './pages/GardenBuilder';
import GardenDiary from './pages/GardenDiary';
import GardenPlanting from './pages/GardenPlanting';
import Gardens from './pages/Gardens';
import GrowLists from './pages/GrowLists';
import GrowingProfile from './pages/GrowingProfile';
import HarvestLog from './pages/HarvestLog';
import ImageSubmissions from './pages/ImageSubmissions';
import IssuesLog from './pages/IssuesLog';
import Landing from './pages/Landing';
import MyGarden from './pages/MyGarden';
import MyPlants from './pages/MyPlants';
import Onboarding from './pages/Onboarding';
import PlantCatalog from './pages/PlantCatalog';
import PlantCatalogBrowse from './pages/PlantCatalogBrowse';
import PlantCatalogDetail from './pages/PlantCatalogDetail';
import PlantCatalogV2 from './pages/PlantCatalogV2';
import PlotBuilder from './pages/PlotBuilder';
import PublicGarden from './pages/PublicGarden';
import SeedInventory from './pages/SeedInventory';
import SeedStash from './pages/SeedStash';
import SeedStashDetail from './pages/SeedStashDetail';
import Settings from './pages/Settings';
import SubcategoryMapping from './pages/SubcategoryMapping';
import Users from './pages/Users';
import VarietyReviewQueue from './pages/VarietyReviewQueue';
import ViewVariety from './pages/ViewVariety';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminAuditLog": AdminAuditLog,
    "AdminDataCleanup": AdminDataCleanup,
    "AdminDataImport": AdminDataImport,
    "AdminDataMaintenance": AdminDataMaintenance,
    "AdminDeduplicateVarieties": AdminDeduplicateVarieties,
    "AdminLog": AdminLog,
    "BrowseCategoryConfig": BrowseCategoryConfig,
    "BrowseGardens": BrowseGardens,
    "Calendar": Calendar,
    "CalendarPlanner": CalendarPlanner,
    "CalendarTasks": CalendarTasks,
    "ChangeRequests": ChangeRequests,
    "Community": Community,
    "CommunityBoard": CommunityBoard,
    "CompanionPlanner": CompanionPlanner,
    "CompanionRuleImport": CompanionRuleImport,
    "CompanionRulesAudit": CompanionRulesAudit,
    "Dashboard": Dashboard,
    "EditPlantType": EditPlantType,
    "EditVariety": EditVariety,
    "EditorReviewQueue": EditorReviewQueue,
    "FeatureRequests": FeatureRequests,
    "ForumAdmin": ForumAdmin,
    "ForumCategory": ForumCategory,
    "ForumTopic": ForumTopic,
    "GardenBuilder": GardenBuilder,
    "GardenDiary": GardenDiary,
    "GardenPlanting": GardenPlanting,
    "Gardens": Gardens,
    "GrowLists": GrowLists,
    "GrowingProfile": GrowingProfile,
    "HarvestLog": HarvestLog,
    "ImageSubmissions": ImageSubmissions,
    "IssuesLog": IssuesLog,
    "Landing": Landing,
    "MyGarden": MyGarden,
    "MyPlants": MyPlants,
    "Onboarding": Onboarding,
    "PlantCatalog": PlantCatalog,
    "PlantCatalogBrowse": PlantCatalogBrowse,
    "PlantCatalogDetail": PlantCatalogDetail,
    "PlantCatalogV2": PlantCatalogV2,
    "PlotBuilder": PlotBuilder,
    "PublicGarden": PublicGarden,
    "SeedInventory": SeedInventory,
    "SeedStash": SeedStash,
    "SeedStashDetail": SeedStashDetail,
    "Settings": Settings,
    "SubcategoryMapping": SubcategoryMapping,
    "Users": Users,
    "VarietyReviewQueue": VarietyReviewQueue,
    "ViewVariety": ViewVariety,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};