import "./CardSpace.css";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import localVideImg from "../../../../assets/images/empty-space.webp";
import sallereunionImg from "../../../../assets/images/meeting-room.webp";
import openspaceImg from "../../../../assets/images/openspace.webp";
import studioPhotoImg from "../../../../assets/images/photo-studio.webp";
import studioEnregImg from "../../../../assets/images/studios.webp";
import type { Space } from "../../../../types/space";
import SpaceModal from "../SpaceModal/SpaceModal";
import SpaceModalContent from "../SpaceModal/SpaceModalContent/SpaceModalContent";

type CardSpaceProps = {
  spaces: Space[];
  categoryName: string;
};

const CATEGORY_IMAGES: Record<string, string> = {
  "Open space": openspaceImg,
  "Studio photo": studioPhotoImg,
  "Studio d'enregistrement": studioEnregImg,
  "Salle de réunion": sallereunionImg,
  "Local vide": localVideImg,
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Openspace:
    "Espace de travail collaboratif, idéal pour travailler seul ou en équipe dans une ambiance dynamique.",
  "Studio photo":
    "Studio entièrement équipé avec éclairage professionnel, fonds et accessoires pour vos séances photo.",
  "Studio d'enregistrement":
    "Studio insonorisé avec matériel audio haut de gamme pour l'enregistrement, le mixage et le podcast.",
  "Local vide":
    "Espace brut et modulable, à aménager selon vos besoins : événement, stockage, activité professionnelle.",
  "Salle de réunion":
    "Salle équipée (écran, visioconférence, tableau blanc) pour vos réunions, formations et présentations.",
};

function CardSpace({ spaces, categoryName }: CardSpaceProps) {
  if (spaces.length === 0) return null;

  const firstSpace = spaces[0];
  const [isModalOpen, setIsModalOpen] = useState(false);

  const spaceCategory = firstSpace.space_category;
  const minPrice = Math.min(...spaces.map((space) => space.price_unit));

  return (
    <>
      <div className="card-space-card-div">
        <div className="card-space-card-img-div">
          <img
            className="card-space-card-img"
            src={CATEGORY_IMAGES[spaceCategory] ?? openspaceImg}
            alt={categoryName}
          />
          <span className="card-space-card-badge-price">Dès {minPrice}€</span>
          <h3 className="card-space-card-name">{categoryName}</h3>
        </div>

        <div className="card-space-card-info-div">
          <p className="card-space-card-timeslot">
            {CATEGORY_DESCRIPTIONS[spaceCategory] ??
              "Espace disponible à la réservation."}
          </p>

          <button
            type="button"
            className="card-space-card-reservation-button"
            onClick={() => setIsModalOpen(true)}
          >
            Voir les espaces
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <SpaceModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          >
            <SpaceModalContent
              spaces={spaces}
              categoryName={categoryName}
              onClose={() => setIsModalOpen(false)}
            />
          </SpaceModal>
        )}
      </AnimatePresence>
    </>
  );
}

export default CardSpace;
