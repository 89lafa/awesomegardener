/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AIAssistants from './pages/AIAssistants';
import Achievements from './pages/Achievements';
import AdminAuditLog from './pages/AdminAuditLog';
import AdminBulkEdit from './pages/AdminBulkEdit';
import AdminDataCleanup from './pages/AdminDataCleanup';
import AdminDataImport from './pages/AdminDataImport';
import AdminDataMaintenance from './pages/AdminDataMaintenance';
import AdminDeduplicateVarieties from './pages/AdminDeduplicateVarieties';
import AdminHub from './pages/AdminHub';
import AdminLog from './pages/AdminLog';
import AdminPestLibrary from './pages/AdminPestLibrary';
import AdminResources from './pages/AdminResources';
import BrowseCategoryConfig from './pages/BrowseCategoryConfig';
import BrowseGardens from './pages/BrowseGardens';
import Calendar from './pages/Calendar';
import CalendarPlanner from './pages/CalendarPlanner';
import CalendarTasks from './pages/CalendarTasks';
import CalendarTasksKanban from './pages/CalendarTasksKanban';
import Challenges from './pages/Challenges';
import ChangeRequests from './pages/ChangeRequests';
import Community from './pages/Community';
import CommunityBoard from './pages/CommunityBoard';
import CompanionPlanner from './pages/CompanionPlanner';
import CompanionRuleImport from './pages/CompanionRuleImport';
import CompanionRulesAudit from './pages/CompanionRulesAudit';
import Dashboard from './pages/Dashboard';
import DebugFeatures from './pages/DebugFeatures';
import EditPlantType from './pages/EditPlantType';
import EditVariety from './pages/EditVariety';
import EditorReviewQueue from './pages/EditorReviewQueue';
import FeatureRequests from './pages/FeatureRequests';
import ForumAdmin from './pages/ForumAdmin';
import ForumCategory from './pages/ForumCategory';
import ForumTopic from './pages/ForumTopic';
import GardenBuilder from './pages/GardenBuilder';
import GardenCare from './pages/GardenCare';
import GardenDiary from './pages/GardenDiary';
import GardenExpenses from './pages/GardenExpenses';
import GardenPlanting from './pages/GardenPlanting';
import GardeningBasics from './pages/GardeningBasics';
import Gardens from './pages/Gardens';
import GlobalSearch from './pages/GlobalSearch';
import GrowLists from './pages/GrowLists';
import GrowingProfile from './pages/GrowingProfile';
import HarvestLog from './pages/HarvestLog';
import ImageSubmissions from './pages/ImageSubmissions';
import IndoorGrowSpaces from './pages/IndoorGrowSpaces';
import IndoorSpaceDetail from './pages/IndoorSpaceDetail';
import IssuesLog from './pages/IssuesLog';
import Landing from './pages/Landing';
import Leaderboard from './pages/Leaderboard';
import ManageForumCategories from './pages/ManageForumCategories';
import Messages from './pages/Messages';
import MyGarden from './pages/MyGarden';
import MyPlants from './pages/MyPlants';
import NeedToBuy from './pages/NeedToBuy';
import Notifications from './pages/Notifications';
import Onboarding from './pages/Onboarding';
import PestDetail from './pages/PestDetail';
import PestLibrary from './pages/PestLibrary';
import PlantCatalog from './pages/PlantCatalog';
import PlantCatalogBrowse from './pages/PlantCatalogBrowse';
import PlantCatalogDetail from './pages/PlantCatalogDetail';
import PlantCatalogV2 from './pages/PlantCatalogV2';
import PlotBuilder from './pages/PlotBuilder';
import PublicGarden from './pages/PublicGarden';
import PublicPlant from './pages/PublicPlant';
import PublicSeed from './pages/PublicSeed';
import RecipeDetail from './pages/RecipeDetail';
import Recipes from './pages/Recipes';
import ResourceArticle from './pages/ResourceArticle';
import Resources from './pages/Resources';
import SeedInventory from './pages/SeedInventory';
import SeedStash from './pages/SeedStash';
import SeedStashDetail from './pages/SeedStashDetail';
import SeedTrading from './pages/SeedTrading';
import Settings from './pages/Settings';
import ShipAudit from './pages/ShipAudit';
import SubcategoryMapping from './pages/SubcategoryMapping';
import TrayDetail from './pages/TrayDetail';
import UserReports from './pages/UserReports';
import Users from './pages/Users';
import VarietyReviewQueue from './pages/VarietyReviewQueue';
import ViewVariety from './pages/ViewVariety';
import ZoneMap from './pages/ZoneMap';
import AdminChallenges from './pages/AdminChallenges';
import AdminAchievements from './pages/AdminAchievements';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAssistants": AIAssistants,
    "Achievements": Achievements,
    "AdminAuditLog": AdminAuditLog,
    "AdminBulkEdit": AdminBulkEdit,
    "AdminDataCleanup": AdminDataCleanup,
    "AdminDataImport": AdminDataImport,
    "AdminDataMaintenance": AdminDataMaintenance,
    "AdminDeduplicateVarieties": AdminDeduplicateVarieties,
    "AdminHub": AdminHub,
    "AdminLog": AdminLog,
    "AdminPestLibrary": AdminPestLibrary,
    "AdminResources": AdminResources,
    "BrowseCategoryConfig": BrowseCategoryConfig,
    "BrowseGardens": BrowseGardens,
    "Calendar": Calendar,
    "CalendarPlanner": CalendarPlanner,
    "CalendarTasks": CalendarTasks,
    "CalendarTasksKanban": CalendarTasksKanban,
    "Challenges": Challenges,
    "ChangeRequests": ChangeRequests,
    "Community": Community,
    "CommunityBoard": CommunityBoard,
    "CompanionPlanner": CompanionPlanner,
    "CompanionRuleImport": CompanionRuleImport,
    "CompanionRulesAudit": CompanionRulesAudit,
    "Dashboard": Dashboard,
    "DebugFeatures": DebugFeatures,
    "EditPlantType": EditPlantType,
    "EditVariety": EditVariety,
    "EditorReviewQueue": EditorReviewQueue,
    "FeatureRequests": FeatureRequests,
    "ForumAdmin": ForumAdmin,
    "ForumCategory": ForumCategory,
    "ForumTopic": ForumTopic,
    "GardenBuilder": GardenBuilder,
    "GardenCare": GardenCare,
    "GardenDiary": GardenDiary,
    "GardenExpenses": GardenExpenses,
    "GardenPlanting": GardenPlanting,
    "GardeningBasics": GardeningBasics,
    "Gardens": Gardens,
    "GlobalSearch": GlobalSearch,
    "GrowLists": GrowLists,
    "GrowingProfile": GrowingProfile,
    "HarvestLog": HarvestLog,
    "ImageSubmissions": ImageSubmissions,
    "IndoorGrowSpaces": IndoorGrowSpaces,
    "IndoorSpaceDetail": IndoorSpaceDetail,
    "IssuesLog": IssuesLog,
    "Landing": Landing,
    "Leaderboard": Leaderboard,
    "ManageForumCategories": ManageForumCategories,
    "Messages": Messages,
    "MyGarden": MyGarden,
    "MyPlants": MyPlants,
    "NeedToBuy": NeedToBuy,
    "Notifications": Notifications,
    "Onboarding": Onboarding,
    "PestDetail": PestDetail,
    "PestLibrary": PestLibrary,
    "PlantCatalog": PlantCatalog,
    "PlantCatalogBrowse": PlantCatalogBrowse,
    "PlantCatalogDetail": PlantCatalogDetail,
    "PlantCatalogV2": PlantCatalogV2,
    "PlotBuilder": PlotBuilder,
    "PublicGarden": PublicGarden,
    "PublicPlant": PublicPlant,
    "PublicSeed": PublicSeed,
    "RecipeDetail": RecipeDetail,
    "Recipes": Recipes,
    "ResourceArticle": ResourceArticle,
    "Resources": Resources,
    "SeedInventory": SeedInventory,
    "SeedStash": SeedStash,
    "SeedStashDetail": SeedStashDetail,
    "SeedTrading": SeedTrading,
    "Settings": Settings,
    "ShipAudit": ShipAudit,
    "SubcategoryMapping": SubcategoryMapping,
    "TrayDetail": TrayDetail,
    "UserReports": UserReports,
    "Users": Users,
    "VarietyReviewQueue": VarietyReviewQueue,
    "ViewVariety": ViewVariety,
    "ZoneMap": ZoneMap,
    "AdminChallenges": AdminChallenges,
    "AdminAchievements": AdminAchievements,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};